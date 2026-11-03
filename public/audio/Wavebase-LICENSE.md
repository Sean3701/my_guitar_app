# Guitar reference samples

Source library: Wavebase / ClueSurf
Source: https://github.com/cluesurf/wave/tree/make/base/guitar/stratocaster
License: Public Domain (the repository states "Files: Public Domain")

The six files guitar-e2.wav, guitar-a2.wav, guitar-d3.wav, guitar-g3.wav,
guitar-b3.wav and guitar-e4.wav are derived from these separate recordings:

- string-6-E-as-E2.wav
- string-5-A-as-A2.wav
- string-4-D-as-D3.wav
- string-3-G-as-G3.wav
- string-2-B-as-B3.wav
- string-1-E-as-E4.wav

Local processing: mono conversion, 32 kHz resampling, individual pitch
calibration to A4 = 440 Hz, peak normalization, and short edge fades.
Rebuild with `python scripts/build-guitar-samples.py`.
