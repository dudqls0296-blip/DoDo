// 고민저장소 · WebGL2 바이닐 렌더러
// 레이캐스팅 셰이더로 동심원 홈, 무광 브라스 라벨, 빛을 받는 가장자리, 떠 있는 그림자를 그린다.
// (Three.js 없이 직접 구현 — 지연 로딩되는 별도 모듈)

const VERT = `#version 300 es
in vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2 uRes;
uniform mat3 uRot;      // 로컬 → 월드
uniform float uSpin;    // 회전 각도(rad)
uniform vec3 uLightPos; // 월드 좌표의 따뜻한 키 라이트
uniform sampler2D uLabel;
uniform float uScale;

const float H = 0.014;       // 두께의 절반
const float LABEL_R = 0.335;
const float SHADOW_Z = -0.46;
const float PI = 3.14159265;

float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }

vec3 tonemap(vec3 c){ c = 1.0 - exp(-c*1.35); return pow(c, vec3(1.0/2.2)); }

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*uRes) / uRes.y * 2.0 / uScale;
  vec3 ro = vec3(0.0, 0.0, 3.4);
  vec3 rd = normalize(vec3(uv*0.36, -1.0));
  mat3 Rt = transpose(uRot);
  vec3 roL = Rt*ro;
  vec3 rdL = Rt*rd;
  vec3 lpL = Rt*uLightPos;

  float tTop = 1e9, tRim = 1e9;
  vec3 pTop;
  float rTop = 9.0;
  if (rdL.z < 0.0){
    tTop = (H - roL.z)/rdL.z;
    pTop = roL + rdL*tTop;
    rTop = length(pTop.xy);
  }
  // 가장자리(원기둥)
  float a = dot(rdL.xy, rdL.xy);
  float b = 2.0*dot(roL.xy, rdL.xy);
  float c = dot(roL.xy, roL.xy) - 1.0;
  float disc = b*b - 4.0*a*c;
  vec3 pRim;
  if (disc > 0.0){
    float t = (-b - sqrt(disc))/(2.0*a);
    pRim = roL + rdL*t;
    if (abs(pRim.z) <= H) tRim = t;
  }

  float fw = fwidth(rTop);
  float cover = 1.0 - smoothstep(1.0 - fw, 1.0, rTop);
  bool hitTop = rTop < 1.0;
  bool hitRim = tRim < 1e8 && (!hitTop || tRim < tTop);

  // ── 그림자 평면 ──
  float shadow = 0.0;
  {
    float ts = (SHADOW_Z - roL.z)/rdL.z;
    vec3 P = roL + rdL*ts;
    vec3 Ld = normalize(lpL);
    vec3 Pp = P + Ld*((0.0 - P.z)/Ld.z);
    float rp = length(Pp.xy);
    shadow = (1.0 - smoothstep(0.7, 1.32, rp))*0.68;
    shadow = max(shadow, (1.0 - smoothstep(0.3, 1.5, length(P.xy)))*0.22);
  }

  vec2 e = gl_FragCoord.xy / uRes;
  shadow *= smoothstep(0.0, 0.16, e.x) * smoothstep(1.0, 0.84, e.x) * smoothstep(0.0, 0.16, e.y) * smoothstep(1.0, 0.84, e.y);
  vec3 col = vec3(0.0);
  float alpha = 0.0;

  if (hitTop || hitRim){
    vec3 p = hitRim && !hitTop ? pRim : pTop;
    vec3 V = normalize(roL - p);
    vec3 L = normalize(lpL - p);
    float dist = length(lpL - p);
    float atten = 7.5/(dist*dist);
    vec3 warm = vec3(1.0, 0.82, 0.6);

    if (hitRim && !hitTop){
      vec3 N = normalize(vec3(p.xy, 0.0));
      vec3 Hh = normalize(L+V);
      float spec = pow(max(dot(N,Hh),0.0), 40.0);
      vec3 brass = vec3(0.47, 0.34, 0.16);
      col = vec3(0.02) + brass*0.25*max(dot(N,L),0.0)*atten + warm*spec*1.6*atten;
      alpha = 1.0;
    } else {
      float r = rTop;
      float th = atan(p.y, p.x);
      vec2 rd2 = p.xy / max(r, 1e-4);
      vec3 T = vec3(-rd2.y, rd2.x, 0.0);
      vec3 Hh = normalize(L+V);

      if (r < 0.021){
        col = vec3(0.01);
      } else if (r < LABEL_R){
        // 무광 브라스 라벨 + 인쇄
        float rs = uSpin;
        vec2 q = mat2(cos(rs), -sin(rs), sin(rs), cos(rs)) * p.xy;
        vec4 ink = texture(uLabel, q/(2.0*LABEL_R) + 0.5);
        vec3 brass = vec3(0.50, 0.36, 0.17);
        float brushed = 0.93 + 0.07*sin(r*900.0 + hash(vec2(floor(r*300.0), 1.0))*6.0);
        vec3 N = vec3(0.0,0.0,1.0);
        float ndl = max(dot(N,L),0.0);
        float TdH = dot(T,Hh);
        float aniso = pow(sqrt(max(1.0 - TdH*TdH, 0.0)), 28.0);
        vec3 base = brass*brushed;
        vec3 inkCol = vec3(0.075, 0.12, 0.1);
        base = mix(base, inkCol, ink.a*0.92);
        col = base*(0.18 + 0.95*ndl*atten) + warm*aniso*0.22*atten*(1.0 - ink.a*0.7);
        // 라벨 테두리 금속 띠
        float edge = smoothstep(LABEL_R-0.012, LABEL_R-0.004, r);
        col = mix(col, brass*0.7 + warm*0.45*pow(max(dot(vec3(rd2*0.6,0.8), L),0.0),6.0)*atten, edge*0.85);
      } else {
        // 비닐 면: 동심원 홈
        float gf = 210.0;
        float gr = r*gf;
        float fade = clamp(1.0 - fwidth(gr)*1.4, 0.0, 1.0);
        float deadwax = smoothstep(LABEL_R+0.05, LABEL_R+0.06, r) * (1.0 - smoothstep(0.975, 0.985, r));
        float gaps = 1.0;
        for (int i = 0; i < 4; i++){
          float gpos = 0.47 + float(i)*0.125;
          gaps *= smoothstep(0.0025, 0.006, abs(r - gpos));
        }
        float groove = sin(gr*2.0*PI) * fade * deadwax * gaps;
        float micro = sin(r*1350.0) * clamp(1.0 - fwidth(r*1350.0)*1.2, 0.0, 1.0) * deadwax;
        vec3 N = normalize(vec3(rd2*(groove*0.10 + micro*0.05), 1.0));
        float TdH = dot(T,Hh);
        float s1 = pow(sqrt(max(1.0 - TdH*TdH, 0.0)), 700.0);
        float s2 = pow(sqrt(max(1.0 - TdH*TdH, 0.0)), 50.0);
        float ndl = max(dot(N,L),0.0);
        float ndh = max(dot(N,Hh),0.0);
        float bandVar = 0.82 + 0.18*sin(r*41.0) * deadwax;
        vec3 base = vec3(0.028, 0.034, 0.031);
        col = base*(0.4 + ndl*atten*0.9);
        col += warm*(s1*1.9 + s2*0.32)*bandVar*atten*(gaps*0.7 + 0.3) * ndl;
        col += warm*pow(ndh, 260.0)*0.9*atten*(1.0 - deadwax*0.6);
        // 먼지 점 (회전과 함께 움직임)
        float th2 = th - uSpin;
        vec2 cell = vec2(floor(r*90.0), floor((th2/(2.0*PI)+0.5)*360.0));
        float d = hash(cell);
        col += vec3(0.5,0.48,0.42)*step(0.9993, d)*0.18*atten;
        // 빛을 받는 얇은 바깥 테두리(베벨)
        float bevel = smoothstep(0.986, 0.997, r);
        float facing = pow(max(dot(normalize(vec3(rd2, 0.55)), L), 0.0), 5.0);
        col += vec3(0.95, 0.78, 0.5)*bevel*facing*1.1*atten;
        col += vec3(0.47,0.34,0.16)*bevel*0.08;
      }
      alpha = cover;
      if (hitRim) alpha = 1.0;
    }
  }

  vec3 outc = tonemap(col);
  // 프리멀티플라이드 알파 합성: 바이닐 위 / 그림자 아래
  float a2 = alpha + shadow*(1.0 - alpha);
  vec3 c2 = outc*alpha;
  outColor = vec4(c2, a2);
}`;

export interface VinylRenderer {
  setPose(tiltX: number, tiltY: number): void;
  setSpin(rad: number): void;
  setLabel(lines: { top: string; center: string; bottom: string }): void;
  render(): void;
  resize(): void;
  dispose(): void;
}

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error('shader: ' + log);
  }
  return s;
}

function rotX(a: number) { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, s, 0, -s, c]; }
function rotY(a: number) { const c = Math.cos(a), s = Math.sin(a); return [c, 0, -s, 0, 1, 0, s, 0, c]; }
function rotZ(a: number) { const c = Math.cos(a), s = Math.sin(a); return [c, s, 0, -s, c, 0, 0, 0, 1]; }
// 열 우선 3x3 곱
function mul(a: number[], b: number[]) {
  const o = new Array(9).fill(0);
  for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) o[c * 3 + r] += a[k * 3 + r] * b[c * 3 + k];
  return o;
}

export function drawLabel(cv: HTMLCanvasElement, lines: { top: string; center: string; bottom: string }) {
  const S = cv.width;
  const g = cv.getContext('2d')!;
  g.clearRect(0, 0, S, S);
  g.save();
  g.translate(S / 2, S / 2);
  g.fillStyle = '#000';
  g.strokeStyle = '#000';
  const R = S / 2;
  g.lineWidth = S * 0.004;
  for (const rr of [0.93, 0.6]) { g.beginPath(); g.arc(0, 0, R * rr, 0, Math.PI * 2); g.stroke(); }
  g.lineWidth = S * 0.0015;
  g.beginPath(); g.arc(0, 0, R * 0.9, 0, Math.PI * 2); g.stroke();
  // 둥근 글자 띠
  const serif = '"Noto Serif KR", "Nanum Myeongjo", serif';
  const ring = (text: string, radius: number, size: number, start: number) => {
    g.font = `600 ${size}px ${serif}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const chars = [...text];
    const step = (size * 0.95) / radius;
    let ang = start - (step * (chars.length - 1)) / 2;
    for (const ch of chars) {
      g.save();
      g.rotate(ang);
      g.translate(0, -radius);
      g.fillText(ch, 0, 0);
      g.restore();
      ang += step;
    }
  };
  ring(lines.top, R * 0.76, S * 0.052, 0);
  ring(lines.bottom, R * 0.76, S * 0.04, Math.PI);
  g.font = `700 ${S * 0.085}px ${serif}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(lines.center, 0, -S * 0.02);
  g.font = `500 ${S * 0.034}px Pretendard, system-ui, sans-serif`;
  g.fillText('33⅓', 0, S * 0.12);
  g.restore();
}

export function createVinyl(canvas: HTMLCanvasElement, opts: { dprCap: number }): VinylRenderer | null {
  const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, alpha: true, antialias: false });
  if (!gl) return null;
  let prog: WebGLProgram;
  try {
    prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || 'link');
  } catch (e) {
    console.warn('[고민저장소] WebGL 셰이더 실패, CSS 바이닐로 대체', e);
    return null;
  }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const U = (n: string) => gl.getUniformLocation(prog, n);
  const uRes = U('uRes'), uRot = U('uRot'), uSpin = U('uSpin'), uLight = U('uLightPos'), uLabel = U('uLabel'), uScale = U('uScale');

  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = labelCanvas.height = 1024;
  const tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.uniform1i(uLabel, 0);

  let spin = 0;
  let tilt = [0, 0];
  let labelLines = { top: '고민저장소 · SIDE A', center: '고민저장소', bottom: '밤에 문을 여는 감상실' };

  const uploadLabel = () => {
    drawLabel(labelCanvas, labelLines);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, labelCanvas);
    gl.generateMipmap(gl.TEXTURE_2D);
  };
  uploadLabel();
  if (document.fonts?.ready) document.fonts.ready.then(() => { uploadLabel(); api.render(); });

  const resize = () => {
    // 큰 화면에서도 부드럽도록 렌더링 픽셀 수를 약 360만으로 제한
    const area = Math.max(1, canvas.clientWidth * canvas.clientHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, opts.dprCap, Math.sqrt(3.6e6 / area));
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, w, h);
  };

  const api: VinylRenderer = {
    setPose(x, y) { tilt = [x, y]; },
    setSpin(r) { spin = r; },
    setLabel(l) { labelLines = l; uploadLabel(); },
    resize,
    render() {
      if (gl.isContextLost()) return;
      resize();
      // 비스듬히 놓인 바이닐: 위쪽이 뒤로 눕고 살짝 돌아간 자세
      const pitch = (-38 + tilt[1] * 4) * Math.PI / 180;
      const yaw = (16 + tilt[0] * 4) * Math.PI / 180;
      const roll = (-8) * Math.PI / 180;
      const R = mul(rotZ(roll), mul(rotX(pitch), rotY(yaw)));
      gl.uniformMatrix3fv(uRot, false, new Float32Array(R));
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uSpin, spin);
      gl.uniform3f(uLight, -2.6, 2.9, 2.2);
      const aspect = canvas.width / canvas.height;
      gl.uniform1f(uScale, Math.min(1.08, aspect * 0.98));
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose() {
      gl.deleteTexture(tex);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
  return api;
}
