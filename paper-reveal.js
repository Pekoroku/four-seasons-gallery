/* Old painting paper, revealed by the reader's scroll position. No clock or loop. */
(function (global) {
  'use strict';

  var vertexSource = [
    'attribute vec2 aPosition;',
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = aPosition * 0.5 + 0.5;',
    '  gl_Position = vec4(aPosition, 0.0, 1.0);',
    '}'
  ].join('\n');

  var fragmentSource = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform vec2 uSize;',
    'uniform vec2 uTextureSize;',
    'uniform float uProgress;',
    'uniform float uHasTexture;',
    'uniform sampler2D uPaper;',
    '',
    // A stable, non-periodic value noise keeps every contour fixed when paused.
    'float hash(vec2 p) {',
    '  vec3 p3 = fract(vec3(p.xyx) * 0.1031);',
    '  p3 += dot(p3, p3.yzx + 33.33);',
    '  return fract((p3.x + p3.y) * p3.z);',
    '}',
    'float noise(vec2 p) {',
    '  vec2 i = floor(p);',
    '  vec2 f = fract(p);',
    '  vec2 w = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(hash(i), hash(i + vec2(1.,0.)), w.x),',
    '             mix(hash(i + vec2(0.,1.)), hash(i + vec2(1.,1.)), w.x), w.y);',
    '}',
    // Radius is expressed in the longer viewport dimension, so holes stay
    // physically round before the irregular edge is applied on any screen.
    'float burn(vec2 xy, vec2 scale, vec2 center, float delay, float reach) {',
    '  float t = max(0.0, (uProgress - delay) / (1.0 - delay));',
    '  float radius = reach * pow(t, 1.16) - 0.047;',
    '  return length(xy - center * scale) - radius + step(uProgress, delay) * 2.0;',
    '}',
    'void main() {',
    '  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);',
    '  vec2 scale = uSize / max(uSize.x, uSize.y);',
    '  vec2 xy = uv * scale;',
    '  float pixel = 1.0 / max(uSize.x, uSize.y);',
    '',
    // Warm ivory linen/paper remains available without a network or image.
    '  float pulp = noise(xy * 37.0 + 2.7);',
    '  float tooth = hash(floor(gl_FragCoord.xy / 1.4));',
    '  float fibers = noise(vec2(xy.x * 720.0, xy.y * 64.0));',
    '  vec3 paper = vec3(0.938, 0.923, 0.875);',
    '  paper += (pulp - 0.5) * 0.031 + (tooth - 0.5) * 0.025 + (fibers - 0.5) * 0.015;',
    '  if (uHasTexture > 0.5) {',
    '    float targetAspect = uSize.x / uSize.y;',
    '    float imageAspect = uTextureSize.x / uTextureSize.y;',
    '    vec2 crop = vec2(min(1.0, targetAspect / imageAspect), min(1.0, imageAspect / targetAspect));',
    '    vec2 texUv = (uv - 0.5) * crop + 0.5;',
    '    paper = texture2D(uPaper, texUv).rgb;',
    '    paper += (tooth - 0.5) * 0.008;',
    '  }',
    '  if (uProgress <= 0.00001) { gl_FragColor = vec4(paper, 1.0); return; }',
    '  if (uProgress >= 0.99999) { gl_FragColor = vec4(0.0); return; }',
    '',
    // Shared domain warping and four scales of roughness produce scalloped,
    // torn islands rather than an expanding geometric ellipse or even dissolve.
    '  vec2 warp = vec2(noise(xy * 7.0 + 4.2), noise(xy * 7.0 + 19.8)) - 0.5;',
    '  vec2 warped = xy + warp * 0.048;',
    '  float coarse = noise(xy * 10.8 + 8.4) - 0.5;',
    '  float medium = noise(xy * 35.0 + 21.3) - 0.5;',
    '  float small = noise(xy * 111.0 + 0.7) - 0.5;',
    '  float rough = coarse * 0.072 + medium * 0.033 + small * 0.009;',
    '  float field = burn(warped, scale, vec2(0.57,0.46), 0.00, 0.62);',
    '  field = min(field, burn(warped, scale, vec2(0.24,0.34), 0.02, 0.50));',
    '  field = min(field, burn(warped, scale, vec2(0.79,0.74), 0.05, 0.49));',
    '  field = min(field, burn(warped, scale, vec2(0.85,0.22), 0.08, 0.45));',
    '  field = min(field, burn(warped, scale, vec2(0.27,0.80), 0.04, 0.48));',
    '  field += rough;',
    '',
    // Small pinholes occur ONLY beside an active burn front. They merge into
    // the main opening as the reader continues, never speckling the full paper.
    '  vec2 cells = xy * 83.0;',
    '  vec2 cellId = floor(cells);',
    '  vec2 local = fract(cells) - 0.5;',
    '  float seed = hash(cellId + 61.0);',
    '  float front = (1.0 - smoothstep(0.008, 0.025, field)) * smoothstep(-0.006, 0.004, field);',
    '  float pit = length(local + vec2(hash(cellId+7.2), hash(cellId+24.4)) * 0.20 - 0.10);',
    '  float pock = (1.0 - smoothstep(0.0, 0.085, pit)) * step(0.86, seed) * front;',
    '  field -= pock * 0.027;',
    '',
    // The warm band belongs to the paper itself; the oil painting below is
    // never tinted. A thin dark ash edge leads into a muted amber singe.
    '  float edgeVariation = noise(xy * 170.0 + 4.0);',
    '  float singe = 1.0 - smoothstep(0.003, 0.013 + coarse * 0.006, field);',
    '  float charWidth = 0.0023 + edgeVariation * 0.0014;',
    '  float charred = 1.0 - smoothstep(charWidth * 0.3, charWidth, field);',
    '  float amber = (1.0 - smoothstep(0.0012, 0.0040, abs(field - charWidth))) * 0.38;',
    '  vec3 singeColor = mix(vec3(0.43,0.29,0.16), vec3(0.59,0.42,0.23), pulp);',
    '  vec3 color = mix(paper, singeColor, singe * 0.90);',
    '  color = mix(color, vec3(0.18,0.12,0.085), charred * 0.92);',
    '  color = mix(color, vec3(0.77,0.46,0.20), amber);',
    '  float alpha = smoothstep(-pixel * 1.1, pixel * 1.1, field);',
    // Fade only the last fragments so p=1 never leaves isolated opaque pixels.
    '  alpha *= 1.0 - smoothstep(0.96, 1.0, uProgress);',
    '  gl_FragColor = vec4(color * alpha, alpha);',
    '}'
  ].join('\n');

  function create(canvas, options) {
    options = options || {};
    var destroyed = false;
    var progress = 0;
    var width = 1;
    var height = 1;
    var frame = 0;
    var gl = null;
    var program = null;
    var texture = null;
    var buffer = null;
    var uniforms = null;
    var sourceImage = null;
    var textureWidth = 1;
    var textureHeight = 1;
    var hasTexture = false;
    var isFallback = false;
    var ready = false;
    var originalBackground = canvas.style.background;
    var originalOpacity = canvas.style.opacity;

    function notifyReady() {
      if (ready || destroyed) return;
      ready = true;
      if (typeof options.onReady === 'function') options.onReady(api);
    }

    function useFallback(reason) {
      if (destroyed) return;
      isFallback = true;
      canvas.dataset.renderer = 'fallback';
      canvas.style.background = '#eeeade';
      if (sourceImage && sourceImage.src) {
        canvas.style.backgroundImage = 'url("' + sourceImage.src.replace(/"/g, '%22') + '")';
        canvas.style.backgroundSize = 'cover';
        canvas.style.backgroundPosition = 'center';
      }
      canvas.style.opacity = String(1 - progress);
      if (typeof options.onFallback === 'function') options.onFallback(reason);
      notifyReady();
    }

    function shader(kind, source) {
      var compiled = gl.createShader(kind);
      gl.shaderSource(compiled, source);
      gl.compileShader(compiled);
      if (!gl.getShaderParameter(compiled, gl.COMPILE_STATUS)) {
        var detail = gl.getShaderInfoLog(compiled);
        gl.deleteShader(compiled);
        throw new Error(detail || 'Paper shader compilation failed');
      }
      return compiled;
    }

    function draw() {
      frame = 0;
      if (destroyed) return;
      if (isFallback) {
        canvas.style.opacity = String(1 - progress);
        notifyReady();
        return;
      }
      try {
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.useProgram(program);
        gl.uniform2f(uniforms.size, canvas.width, canvas.height);
        gl.uniform2f(uniforms.textureSize, textureWidth, textureHeight);
        gl.uniform1f(uniforms.progress, progress);
        gl.uniform1f(uniforms.hasTexture, hasTexture ? 1 : 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        notifyReady();
      } catch (error) {
        useFallback('draw');
      }
    }

    function invalidate() {
      if (!destroyed && !frame) frame = global.requestAnimationFrame(draw);
    }

    function uploadImage(image) {
      sourceImage = image;
      if (destroyed) return;
      if (isFallback) { useFallback('texture-ready'); return; }
      try {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        if (gl.getError() !== gl.NO_ERROR) throw new Error('Texture unavailable');
        textureWidth = image.naturalWidth || image.width || 1;
        textureHeight = image.naturalHeight || image.height || 1;
        hasTexture = true;
      } catch (error) {
        // Local file security can deny WebGL image uploads. The shader's own
        // ivory paper texture still provides the entire reversible effect.
        hasTexture = false;
      }
      invalidate();
    }

    function onContextLost(event) {
      event.preventDefault();
      useFallback('context-lost');
    }

    var api = {
      resize: function (nextWidth, nextHeight) {
        if (destroyed) return;
        width = Math.max(1, Number(nextWidth) || canvas.clientWidth || 1);
        height = Math.max(1, Number(nextHeight) || canvas.clientHeight || 1);
        var dpr = Math.min(1.5, global.devicePixelRatio || 1);
        var nextPixelWidth = Math.max(1, Math.round(width * dpr));
        var nextPixelHeight = Math.max(1, Math.round(height * dpr));
        if (canvas.width !== nextPixelWidth) canvas.width = nextPixelWidth;
        if (canvas.height !== nextPixelHeight) canvas.height = nextPixelHeight;
        invalidate();
      },
      setProgress: function (value) {
        if (destroyed) return;
        var next = Math.max(0, Math.min(1, Number(value) || 0));
        if (next === progress) return;
        progress = next;
        invalidate();
      },
      destroy: function () {
        if (destroyed) return;
        destroyed = true;
        if (frame) global.cancelAnimationFrame(frame);
        canvas.removeEventListener('webglcontextlost', onContextLost);
        if (sourceImage) sourceImage.onload = sourceImage.onerror = null;
        if (gl && !gl.isContextLost()) {
          if (buffer) gl.deleteBuffer(buffer);
          if (texture) gl.deleteTexture(texture);
          if (program) gl.deleteProgram(program);
          gl.clearColor(0, 0, 0, 0);
          gl.clear(gl.COLOR_BUFFER_BIT);
        }
        canvas.style.background = originalBackground;
        canvas.style.opacity = originalOpacity;
        delete canvas.dataset.renderer;
      }
    };

    try {
      gl = canvas.getContext('webgl', { alpha: true, antialias: false, depth: false,
        stencil: false, premultipliedAlpha: true, preserveDrawingBuffer: false,
        powerPreference: 'low-power' });
      if (!gl) throw new Error('WebGL unavailable');
      var precision = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
      var fragment = precision && precision.precision ? fragmentSource : fragmentSource.replace('precision highp float;', 'precision mediump float;');
      var vs = shader(gl.VERTEX_SHADER, vertexSource);
      var fs = shader(gl.FRAGMENT_SHADER, fragment);
      program = gl.createProgram();
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Paper shader link failed');
      gl.useProgram(program);
      buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
      var position = gl.getAttribLocation(program, 'aPosition');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      uniforms = {
        size: gl.getUniformLocation(program, 'uSize'),
        textureSize: gl.getUniformLocation(program, 'uTextureSize'),
        progress: gl.getUniformLocation(program, 'uProgress'),
        hasTexture: gl.getUniformLocation(program, 'uHasTexture')
      };
      texture = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([239,235,223,255]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.uniform1i(gl.getUniformLocation(program, 'uPaper'), 0);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      canvas.dataset.renderer = 'webgl';
      canvas.addEventListener('webglcontextlost', onContextLost, false);
    } catch (error) {
      // Queue the callback until after `create` has returned its controller.
      isFallback = true;
    }

    if (isFallback) global.requestAnimationFrame(function () { useFallback('unavailable'); });
    if (options.textureImage && options.textureImage.complete) {
      uploadImage(options.textureImage);
    } else if (options.textureUrl) {
      sourceImage = new Image();
      sourceImage.onload = function () { uploadImage(sourceImage); };
      sourceImage.onerror = function () { invalidate(); };
      sourceImage.src = options.textureUrl;
    }
    api.resize(canvas.clientWidth || canvas.width, canvas.clientHeight || canvas.height);
    return api;
  }

  global.PaperReveal = { create: create };
})(window);
