#!/usr/bin/env python3
"""SMCP 무전 교신 훈련소 · 대사 녹음 만들기

scenarios.js 의 상대 대사(them, retry)와 표준 답안(model)을 고품질 음성(Kokoro TTS)으로 녹음해서
voice/audio/*.mp3 와 voice/manifest.js 를 만듭니다. 이미 있는 녹음은 건너뛰니 대사를 고친 뒤 다시 돌리면 됩니다.

준비 (한 번만):
    pip install kokoro-onnx soundfile
    # ffmpeg 와 node 가 필요해요
    # 모델 파일 2개를 이 폴더(voice/)에 내려받기:
    #   https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.int8.onnx
    #   https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
    #   (모델 파일은 커서 git 에 올리지 않아요)
실행:
    python3 tools/smcp/voice/build.py
"""
import hashlib, json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
AUDIO = os.path.join(HERE, 'audio')
MODEL = os.environ.get('KOKORO_MODEL', os.path.join(HERE, 'kokoro-v1.0.int8.onnx'))
VOICES = os.environ.get('KOKORO_VOICES', os.path.join(HERE, 'voices-v1.0.bin'))

# 무전기 음질: 저음·고음을 자르고, 세게 압축하고, 살짝 찌그러뜨림
RADIO_FX = 'highpass=f=320,lowpass=f=3100,acompressor=threshold=-20dB:ratio=8:attack=3:release=60:makeup=4,asoftclip=type=tanh,volume=0.9'
CLEAN_FX = 'highpass=f=80,acompressor=threshold=-18dB:ratio=3:attack=5:release=80:makeup=2'


def load_data():
    js = "global.window={};require(process.argv[1]);process.stdout.write(JSON.stringify(window.SMCP))"
    out = subprocess.run(['node', '-e', js, os.path.join(ROOT, 'scenarios.js')], check=True, capture_output=True, text=True).stdout
    return json.loads(out)


def parts(text):
    """엔진과 똑같이 '...'(잡음에 묻힌 부분)을 기준으로 나눔"""
    return [p.strip() for p in re.split(r'\s*\.\.\.\s*(?:\.\.\.\s*)?', text) if p.strip()]


ACRONYMS = {'VTS': 'V T S', 'UTC': 'U T C', 'ETA': 'E T A', 'VHF': 'V H F', 'DSC': 'D S C', 'MMSI': 'M M S I'}
SPOKEN = {'SECURITE': 'Securitay', 'PAN-PAN': 'Pan Pan', 'MAYDAY': 'Mayday'}


def speakable(text):
    """읽기 좋게 바꾸기: 약어는 한 글자씩, 대문자 단어는 보통 단어처럼, 숫자 하이픈은 끊어 읽기"""
    def word(m):
        w = m.group(0)
        if w in SPOKEN: return SPOKEN[w]
        if w in ACRONYMS: return ACRONYMS[w]
        return w.capitalize()
    t = re.sub(r'(?<=[a-z])-(?=[a-z])', ', ', text)   # zero-four-five → zero, four, five
    t = re.sub(r"[A-Z][A-Z\-]+[A-Z]", word, t)
    return t


def main():
    D = load_data()
    vconf = D.get('voices', {})
    ship = D['ship']['name']
    jobs = {}   # key → (text, voice, fx, speed)

    def add(role, text, voice):
        for p in parts(text):
            if role == 'model':
                jobs['model|' + p] = (p, vconf.get('model', 'bf_emma'), CLEAN_FX, 1.0)
            else:
                jobs['fx|' + p] = (p, voice, RADIO_FX, 1.0)
                jobs['slow|' + p] = (p, voice, RADIO_FX, 0.78)

    for sc in D['scenarios']:
        station = sc['station']
        voice = vconf.get(station, vconf.get('default', 'bm_george'))
        s_ship = (sc.get('ship') or {}).get('name', ship)
        for t in sc['turns']:
            if t.get('them'): add('them', t['them'], voice)
            add('them', t.get('retry') or f"{s_ship}, {station}. Say again. Over.", voice)
            add('model', t['model'], None)

    os.makedirs(AUDIO, exist_ok=True)
    kok = None
    manifest, made = {}, 0
    for key, (text, voice, fx, speed) in sorted(jobs.items()):
        h = hashlib.sha1(f'{voice}|{speed}|{fx}|{text}'.encode()).hexdigest()[:12]
        name = f'{h}.mp3'
        path = os.path.join(AUDIO, name)
        manifest[key] = 'voice/audio/' + name
        if os.path.exists(path): continue
        if kok is None:
            if not (os.path.exists(MODEL) and os.path.exists(VOICES)):
                sys.exit('모델 파일이 없어요. 이 파일 맨 위의 "준비"를 보고 voice/ 폴더에 내려받아 주세요.')
            import soundfile as sf
            from kokoro_onnx import Kokoro
            kok = Kokoro(MODEL, VOICES)
        import soundfile as sf
        lang = 'en-gb' if voice.startswith('b') else 'en-us'
        audio, sr = kok.create(speakable(text), voice=voice, speed=speed, lang=lang)
        wav = path[:-4] + '.wav'
        sf.write(wav, audio, sr)
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-af', fx, '-ac', '1', '-ar', '24000', '-b:a', '40k', path], check=True)
        os.remove(wav)
        made += 1
        print(f'녹음 {made}: [{voice}{" 느리게" if speed < 1 else ""}] {text}')

    # 더 이상 안 쓰는 녹음 지우기
    used = {os.path.basename(v) for v in manifest.values()}
    removed = 0
    for f in os.listdir(AUDIO):
        if f.endswith('.mp3') and f not in used:
            os.remove(os.path.join(AUDIO, f)); removed += 1

    with open(os.path.join(HERE, 'manifest.js'), 'w', encoding='utf-8') as fp:
        fp.write('/* voice/build.py 가 만든 파일. 직접 고치지 마세요. 대사 → 녹음 파일 */\n')
        fp.write('window.SMCP_VOICE = ' + json.dumps(manifest, ensure_ascii=False, indent=0, sort_keys=True) + ';\n')
    print(f'끝: 새로 녹음 {made}개, 지움 {removed}개, 전체 {len(manifest)}개')


if __name__ == '__main__':
    main()
