"""Rebuild voice-free stereo hall applause from one real hand clap (CC0).
Source: Solo Clap by OwlStorm / Ashe Kirk / Owlish Media.
https://freesound.org/people/OwlStorm/sounds/151219/
Requires numpy, scipy and ffmpeg; these are offline authoring tools only.
"""
from pathlib import Path
import base64, subprocess, tempfile, urllib.request
import numpy as np
from scipy.io import wavfile
from scipy.signal import fftconvolve, butter, sosfilt

rng=np.random.default_rng(151219)
sr=44100
with tempfile.TemporaryDirectory() as temp:
    work=Path(temp)
    source=work/'clap.mp3'
    urllib.request.urlretrieve('https://cdn.freesound.org/previews/151/151219_140737-hq.mp3',source)
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(source),'-ar',str(sr),'-ac','1',str(work/'clap.wav')],check=True)
    _,raw=wavfile.read(work/'clap.wav')
    raw=raw.astype(np.float64)/32768
    peak=int(np.argmax(np.abs(raw)))
    start=max(0,peak-int(.006*sr))
    clap=raw[start:start+int(.24*sr)].copy()
    clap-=np.mean(clap)
    clap*=np.minimum(1,np.arange(len(clap))/90)*np.minimum(1,np.arange(len(clap),0,-1)/900)
    clap/=max(np.max(np.abs(clap)),1e-6)
    dry=np.zeros((int(9.4*sr),2))
    # Each member has their own tempo, stereo position, timbre and distance.
    for person in range(32):
        pan=rng.uniform(-.96,.96)
        distance=rng.uniform(1.5,9)
        pitch=rng.uniform(.76,1.3)
        voice=np.interp(np.arange(0,len(clap)-1,pitch),np.arange(len(clap)),clap)
        voice=sosfilt(butter(2, min(14000,15000/(1+distance*.07)),fs=sr,output='sos'),voice)
        gains=np.array([np.cos((pan+1)*np.pi/4),np.sin((pan+1)*np.pi/4)])/(1+distance*.17)
        tempo=rng.uniform(.27,.48)
        t=rng.uniform(0,.28)
        while t<7.7:
            amplitude=rng.uniform(.55,1.05)*min(1,(t+.2)/.5)*min(1,max(0,(8-t)/1.4))
            for ch in range(2):
                offset=int((t+distance/343+(max(0,pan) if ch==0 else max(0,-pan))*.00055)*sr)
                dry[offset:offset+len(voice),ch]+=voice*amplitude*gains[ch]
            t+=tempo*rng.uniform(.83,1.17)
    wet=np.zeros_like(dry)
    for ch in range(2):
        length=int(sr*1.45)
        time=np.arange(length)/sr
        ir=sosfilt(butter(1,5200,fs=sr,output='sos'),rng.normal(0,1,length))*np.exp(-6.91*time/1.15)
        ir[:int(.035*sr)]=0
        ir*=.32/max(np.linalg.norm(ir),1e-8)
        for delay,level in [(17,.17),(29,.13),(43,.1),(67,.07),(89,.045)]:
            ir[int((delay+ch*3)*sr/1000)]+=level
        wet[:,ch]=fftconvolve(dry[:,ch]*.8+dry[:,1-ch]*.2,ir)[:len(dry)]
    mix=dry*.78+wet*.65
    # Smooth ending, retain the hall decay, and leave headroom for the fanfare.
    fade=np.minimum(1,np.arange(len(mix),0,-1)/(sr*.8))
    mix*=fade[:,None]
    mix*=.78/max(np.max(np.abs(mix)),1e-8)
    wavfile.write(work/'hall.wav',sr,(mix*32767).astype(np.int16))
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(work/'hall.wav'),'-codec:a','libmp3lame','-b:a','160k',str(work/'hall.mp3')],check=True)
    encoded=base64.b64encode((work/'hall.mp3').read_bytes()).decode()
    Path('public/celebration-audio.js').write_text('// Voice-free stereo applause, built from Solo Clap by OwlStorm (Ashe Kirk), CC0.\n// https://freesound.org/people/OwlStorm/sounds/151219/\n// Layered crowd positions, early room reflections and diffuse hall reverberation.\n// Rebuild with scripts/build-applause.py.\nexport default "data:audio/mpeg;base64,'+encoded+'";\n')
    correlation=np.corrcoef(mix.T)[0,1]
    print(f'Stereo hall applause: {len(mix)/sr:.1f}s, peak {np.max(np.abs(mix)):.3f}, L/R correlation {correlation:.3f}, encoded bytes {(work/"hall.mp3").stat().st_size}')
