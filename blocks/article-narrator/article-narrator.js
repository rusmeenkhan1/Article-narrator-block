const TEXT_SELECTORS = 'p, h1, h2, h3, h4, h5, h6, li, blockquote';
const SKIP_SELECTORS = 'header, footer, nav, .article-narrator, [data-narrator-skip]';
const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5];
const WORDS_PER_MINUTE = 150;
const MAX_CHUNK_WORDS = 200;

/**
 * Returns true when the element sits inside a skipped region.
 * @param {Element} element
 */
function shouldSkip(element) {
  return Boolean(element.closest(SKIP_SELECTORS));
}

/**
 * Splits text into word tokens with character offsets.
 * @param {string} text
 * @returns {Array<{ text: string, start: number, end: number }>}
 */
function splitWords(text) {
  const words = [];
  const pattern = /\S+/g;
  let match = pattern.exec(text);
  while (match) {
    words.push({ text: match[0], start: match.index, end: match.index + match[0].length });
    match = pattern.exec(text);
  }
  return words;
}

/**
 * Collects readable segments from the main content area.
 * @param {Element} main
 * @returns {Array<{ node: Element, text: string, words: Array }>}
 */
function collectSegments(main) {
  const candidates = [...main.querySelectorAll(TEXT_SELECTORS)]
    .filter((el) => !shouldSkip(el));

  const elements = candidates.filter(
    (el) => !candidates.some((other) => other !== el && other.contains(el)),
  );

  const segments = [];
  let globalIndex = 0;

  elements.forEach((node) => {
    const text = node.textContent.trim();
    if (!text) return;

    const wordParts = splitWords(text);
    const words = wordParts.map((part) => {
      const entry = {
        globalIndex,
        text: part.text,
        element: node,
        charStart: part.start,
        charEnd: part.end,
      };
      globalIndex += 1;
      return entry;
    });

    if (words.length > 0) {
      segments.push({ node, text, words });
    }
  });

  return segments;
}

/**
 * Flattens segment words into a single ordered list.
 * @param {Array} segments
 */
function flattenWords(segments) {
  return segments.flatMap((segment) => segment.words);
}

/**
 * Resolves character offsets within an element to DOM range endpoints.
 * @param {Element} element
 * @param {number} charStart
 * @param {number} charEnd
 */
function getRangeEndpoints(element, charStart, charEnd) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let offset = 0;
  let startNode = null;
  let startOffset = 0;
  let endNode = null;
  let endOffset = 0;

  while (walker.nextNode()) {
    const textNode = walker.currentNode;
    const { length } = textNode.textContent;
    const nextOffset = offset + length;

    if (!startNode && nextOffset > charStart) {
      startNode = textNode;
      startOffset = charStart - offset;
    }

    if (startNode && nextOffset >= charEnd) {
      endNode = textNode;
      endOffset = charEnd - offset;
      break;
    }

    offset = nextOffset;
  }

  return {
    startNode, startOffset, endNode, endOffset,
  };
}

/**
 * Waits for speech synthesis voices to become available.
 */
function loadVoices() {
  return new Promise((resolve) => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      resolve(voices);
      return;
    }

    const onVoicesChanged = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
      resolve(window.speechSynthesis.getVoices());
    };

    window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
  });
}

/**
 * Filters voices to the page language prefix.
 * @param {SpeechSynthesisVoice[]} voices
 * @param {string} lang
 */
function filterVoicesByLang(voices, lang) {
  const normalized = lang.toLowerCase().split('-')[0];
  const matches = voices.filter((voice) => voice.lang.toLowerCase().startsWith(normalized));
  return matches.length > 0 ? matches : voices;
}

/**
 * Creates an inline SVG element for player icons.
 * @param {string} name
 */
function createIcon(name, size = 20) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');

  const path = document.createElementNS(ns, 'path');
  path.setAttribute('fill', 'currentColor');

  if (name === 'play') {
    path.setAttribute('d', 'M8 5.14v13.72c0 .79.87 1.27 1.54.84l11.14-6.86a1 1 0 0 0 0-1.7L9.54 4.3A1 1 0 0 0 8 5.14z');
  } else if (name === 'pause') {
    path.setAttribute('d', 'M7 5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm8 0a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z');
  } else if (name === 'close') {
    path.setAttribute('d', 'M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12l-4.89 4.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.89a1 1 0 0 0 1.41-1.41L13.41 12l4.89-4.89a1 1 0 0 0 0-1.4z');
  } else if (name === 'listen') {
    path.setAttribute('d', 'M12 3a4 4 0 0 0-4 4v5a4 4 0 0 0 8 0V7a4 4 0 0 0-4-4zm-6 9a1 1 0 1 0-2 0 7 7 0 0 0 6 6.92V21H8a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2h-2v-2.08A7 7 0 0 0 20 12a1 1 0 1 0-2 0 5 5 0 0 1-10 0z');
  }

  svg.append(path);
  return svg;
}

/**
 * Builds utterance chunks capped at 200 words.
 * @param {Array} words
 */
function buildChunks(words) {
  const chunks = [];
  for (let i = 0; i < words.length; i += MAX_CHUNK_WORDS) {
    const slice = words.slice(i, i + MAX_CHUNK_WORDS);
    chunks.push({
      startIndex: i,
      words: slice,
      text: slice.map((word) => word.text).join(' '),
    });
  }
  return chunks;
}

/**
 * Formats remaining time as a human-readable label.
 * @param {number} seconds
 */
function formatRemaining(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0 min remaining';
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return `${minutes} min remaining`;
}

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default function decorate(block) {
  if (!('speechSynthesis' in window)) {
    // eslint-disable-next-line no-console
    console.info('Article narrator: Web Speech API is not supported in this browser.');
    return;
  }

  if (document.querySelector('.article-narrator-player')) {
    block.textContent = '';
    return;
  }

  const main = document.querySelector('main');
  if (!main) return;

  const segments = collectSegments(main);
  const words = flattenWords(segments);
  if (words.length === 0) return;

  block.textContent = '';

  const lang = document.documentElement.lang || 'en';
  const chunks = buildChunks(words);
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let speedIndex = SPEED_OPTIONS.indexOf(1);
  if (speedIndex < 0) speedIndex = 1;
  let currentWordIndex = 0;
  let isActive = false;
  let isPaused = false;
  let currentMark = null;
  let wakeLock = null;
  let selectedVoice = null;
  let boundaryWordCounter = 0;

  const player = document.createElement('div');
  player.className = 'article-narrator-player';
  player.setAttribute('role', 'region');
  player.setAttribute('aria-label', 'Article narrator');

  const inner = document.createElement('div');
  inner.className = 'article-narrator-inner';

  const toolbar = document.createElement('div');
  toolbar.className = 'article-narrator-toolbar';

  const playPauseBtn = document.createElement('button');
  playPauseBtn.type = 'button';
  playPauseBtn.className = 'article-narrator-play';
  playPauseBtn.setAttribute('aria-label', 'Play article');
  const playIcon = createIcon('play', 22);
  const pauseIcon = createIcon('pause', 22);
  pauseIcon.hidden = true;
  playPauseBtn.append(playIcon, pauseIcon);

  const track = document.createElement('div');
  track.className = 'article-narrator-track';

  const trackHeader = document.createElement('div');
  trackHeader.className = 'article-narrator-track-header';

  const title = document.createElement('div');
  title.className = 'article-narrator-title';
  title.append(createIcon('listen', 16));
  const titleText = document.createElement('span');
  titleText.textContent = 'Listen to this article';
  title.append(titleText);

  const timeLabel = document.createElement('span');
  timeLabel.className = 'article-narrator-time';
  timeLabel.textContent = formatRemaining((words.length / WORDS_PER_MINUTE) * 60);

  trackHeader.append(title, timeLabel);

  const progress = document.createElement('div');
  progress.className = 'article-narrator-progress';
  progress.setAttribute('role', 'slider');
  progress.setAttribute('aria-valuemin', '0');
  progress.setAttribute('aria-valuemax', '100');
  progress.setAttribute('aria-valuenow', '0');
  progress.setAttribute('aria-label', 'Reading progress');
  progress.tabIndex = 0;

  const progressFill = document.createElement('div');
  progressFill.className = 'article-narrator-progress-fill';
  const progressThumb = document.createElement('div');
  progressThumb.className = 'article-narrator-progress-thumb';
  progress.append(progressFill, progressThumb);

  track.append(trackHeader, progress);

  const actions = document.createElement('div');
  actions.className = 'article-narrator-actions';

  const speedBtn = document.createElement('button');
  speedBtn.type = 'button';
  speedBtn.className = 'article-narrator-speed';
  speedBtn.textContent = '1×';
  speedBtn.setAttribute('aria-label', 'Playback speed, currently 1x');

  const voiceWrap = document.createElement('div');
  voiceWrap.className = 'article-narrator-voice-wrap';

  const voiceLabel = document.createElement('label');
  voiceLabel.className = 'article-narrator-voice-label';
  voiceLabel.textContent = 'Voice';
  const voiceSelectId = `article-narrator-voice-${Date.now()}`;
  voiceLabel.htmlFor = voiceSelectId;

  const voiceSelect = document.createElement('select');
  voiceSelect.id = voiceSelectId;
  voiceSelect.className = 'article-narrator-voice';
  voiceSelect.setAttribute('aria-label', 'Narrator voice');

  voiceWrap.append(voiceLabel, voiceSelect);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'article-narrator-close';
  closeBtn.setAttribute('aria-label', 'Close narrator');
  closeBtn.append(createIcon('close', 18));

  actions.append(speedBtn, voiceWrap, closeBtn);
  toolbar.append(playPauseBtn, track, actions);
  inner.append(toolbar);
  player.append(inner);
  block.append(player);

  requestAnimationFrame(() => {
    player.classList.add('is-visible');
  });

  function clearHighlight() {
    if (!currentMark || !currentMark.parentNode) {
      currentMark = null;
      return;
    }

    const parent = currentMark.parentNode;
    while (currentMark.firstChild) {
      parent.insertBefore(currentMark.firstChild, currentMark);
    }
    parent.removeChild(currentMark);
    currentMark = null;
  }

  function highlightWord(word) {
    if (!word) return;

    clearHighlight();

    const {
      startNode, startOffset, endNode, endOffset,
    } = getRangeEndpoints(
      word.element,
      word.charStart,
      word.charEnd,
    );

    if (!startNode || !endNode) return;

    const range = document.createRange();
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);

    const mark = document.createElement('mark');
    mark.className = 'narrator-highlight';

    try {
      range.surroundContents(mark);
      currentMark = mark;
      mark.scrollIntoView({
        behavior: prefersReducedMotion ? 'instant' : 'smooth',
        block: 'center',
      });
    } catch (error) {
      // surroundContents can fail when range spans element boundaries
    }
  }

  function getProgressPercent() {
    if (words.length === 0) return 0;
    return Math.min(100, Math.round((currentWordIndex / words.length) * 100));
  }

  function updateProgressUI() {
    const percent = getProgressPercent();
    progressFill.style.width = `${percent}%`;
    progress.style.setProperty('--narrator-progress', `${percent}%`);
    progress.setAttribute('aria-valuenow', String(percent));

    const remainingWords = Math.max(0, words.length - currentWordIndex);
    const remainingSeconds = (remainingWords / (WORDS_PER_MINUTE * SPEED_OPTIONS[speedIndex])) * 60;
    timeLabel.textContent = formatRemaining(remainingSeconds);
  }

  function isAudiblyPlaying() {
    return isActive && !isPaused;
  }

  function setPlayingState(playing) {
    playIcon.hidden = playing;
    pauseIcon.hidden = !playing;
    player.classList.toggle('is-playing', playing);
    playPauseBtn.setAttribute('aria-label', playing ? 'Pause article' : 'Play article');
  }

  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => {
          wakeLock = null;
        });
      }
    } catch (error) {
      // Wake Lock API unsupported or request denied
    }
  }

  async function releaseWakeLock() {
    try {
      if (wakeLock) {
        await wakeLock.release();
        wakeLock = null;
      }
    } catch (error) {
      wakeLock = null;
    }
  }

  function getChunkIndexForWord(wordIndex) {
    for (let i = chunks.length - 1; i >= 0; i -= 1) {
      if (wordIndex >= chunks[i].startIndex) return i;
    }
    return 0;
  }

  function speakChunk(chunkIndex, wordOffsetInChunk = 0) {
    const chunk = chunks[chunkIndex];
    if (!chunk) return;

    const chunkWords = chunk.words.slice(wordOffsetInChunk);
    if (chunkWords.length === 0) {
      if (chunkIndex + 1 < chunks.length) {
        speakChunk(chunkIndex + 1, 0);
      } else {
        isActive = false;
        setPlayingState(false);
        isPaused = false;
        releaseWakeLock();
      }
      return;
    }

    boundaryWordCounter = 0;

    const utterance = new SpeechSynthesisUtterance(chunkWords.map((word) => word.text).join(' '));
    utterance.rate = SPEED_OPTIONS[speedIndex];
    utterance.lang = lang;
    if (selectedVoice) utterance.voice = selectedVoice;

    utterance.onboundary = (event) => {
      if (event.name !== 'word') return;

      const spokenWordIndex = chunk.startIndex + wordOffsetInChunk + boundaryWordCounter;
      if (spokenWordIndex < words.length) {
        currentWordIndex = spokenWordIndex;
        highlightWord(words[spokenWordIndex]);
        updateProgressUI();
      }
      boundaryWordCounter += 1;
    };

    utterance.onend = () => {
      if (!isActive || isPaused) return;

      const nextChunk = chunkIndex + 1;
      if (nextChunk < chunks.length) {
        speakChunk(nextChunk, 0);
        return;
      }

      currentWordIndex = words.length;
      updateProgressUI();
      isActive = false;
      setPlayingState(false);
      isPaused = false;
      releaseWakeLock();
    };

    utterance.onerror = () => {
      isActive = false;
      setPlayingState(false);
      isPaused = false;
      releaseWakeLock();
    };

    window.speechSynthesis.speak(utterance);
  }

  function startFromWordIndex(wordIndex) {
    window.speechSynthesis.cancel();
    clearHighlight();

    currentWordIndex = Math.max(0, Math.min(wordIndex, words.length));
    const chunkIndex = getChunkIndexForWord(currentWordIndex);
    const chunk = chunks[chunkIndex];
    const offsetInChunk = currentWordIndex - chunk.startIndex;

    if (currentWordIndex < words.length) {
      highlightWord(words[currentWordIndex]);
    }

    updateProgressUI();
    speakChunk(chunkIndex, offsetInChunk);
  }

  function play() {
    if (isPaused) {
      isPaused = false;
      setPlayingState(true);
      window.speechSynthesis.resume();
      requestWakeLock();
      return;
    }

    if (isActive) return;

    isActive = true;
    isPaused = false;
    setPlayingState(true);
    requestWakeLock();

    if (currentWordIndex >= words.length) {
      currentWordIndex = 0;
    }

    startFromWordIndex(currentWordIndex);
  }

  function pause() {
    if (!isActive || isPaused) return;

    isPaused = true;
    setPlayingState(false);
    window.speechSynthesis.pause();
    releaseWakeLock();
  }

  function stop() {
    window.speechSynthesis.cancel();
    isActive = false;
    isPaused = false;
    setPlayingState(false);
    clearHighlight();
    releaseWakeLock();
  }

  function closePlayer() {
    stop();
    player.classList.remove('is-visible');
    window.setTimeout(() => {
      block.remove();
    }, 300);
  }

  function seekToPercent(percent) {
    const clamped = Math.max(0, Math.min(1, percent));
    const targetIndex = Math.floor(clamped * words.length);
    const wasPlaying = isAudiblyPlaying();

    stop();

    currentWordIndex = Math.min(targetIndex, words.length - 1);
    updateProgressUI();

    if (wasPlaying) {
      play();
    }
  }

  playPauseBtn.addEventListener('click', () => {
    if (isAudiblyPlaying()) {
      pause();
    } else {
      play();
    }
  });

  progress.addEventListener('click', (event) => {
    const rect = progress.getBoundingClientRect();
    const percent = (event.clientX - rect.left) / rect.width;
    seekToPercent(percent);
  });

  progress.addEventListener('keydown', (event) => {
    let percent = getProgressPercent() / 100;
    if (event.key === 'ArrowRight') percent += 0.05;
    else if (event.key === 'ArrowLeft') percent -= 0.05;
    else return;

    event.preventDefault();
    seekToPercent(percent);
  });

  speedBtn.addEventListener('click', () => {
    speedIndex = (speedIndex + 1) % SPEED_OPTIONS.length;
    const speed = SPEED_OPTIONS[speedIndex];
    speedBtn.textContent = `${speed}×`;
    speedBtn.setAttribute('aria-label', `Playback speed, currently ${speed}x`);

    const wasPlaying = isAudiblyPlaying();
    stop();
    updateProgressUI();

    if (wasPlaying) {
      play();
    }
  });

  voiceSelect.addEventListener('change', () => {
    const voice = voiceSelect.selectedOptions[0]?.voice;
    if (voice) selectedVoice = voice;

    const wasPlaying = isAudiblyPlaying();
    stop();

    if (wasPlaying) {
      play();
    }
  });

  closeBtn.addEventListener('click', closePlayer);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && isAudiblyPlaying()) {
      requestWakeLock();
    }
  });

  loadVoices().then((voices) => {
    const filtered = filterVoicesByLang(voices, lang);
    filtered.forEach((voice, index) => {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = `${voice.name} (${voice.lang})`;
      option.voice = voice;
      voiceSelect.append(option);
    });

    if (filtered.length > 0) {
      const defaultVoice = filtered.find((voice) => voice.default) || filtered[0];
      selectedVoice = defaultVoice;
      const defaultIndex = filtered.indexOf(defaultVoice);
      voiceSelect.selectedIndex = defaultIndex;
    }
  });
}
