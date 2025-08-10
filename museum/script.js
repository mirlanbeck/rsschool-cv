// ================== ГЛОБАЛЬНО: ссылки на плееры ==================
let mainVideoEl = null; // большой кастомный <video>
let ytPlayers = []; // YouTube-плееры только для РЕАЛЬНЫХ слайдов (без клонов)
let ytIds = []; // data-video-id реальных слайдов

// ================== ВСПОМОГАТЕЛЬНОЕ ==================
function pauseAllYt(exceptIndex = -1) {
  ytPlayers.forEach((p, i) => {
    if (i !== exceptIndex && p && typeof p.pauseVideo === "function") {
      p.pauseVideo();
    }
  });
}

function pauseMainVideo() {
  if (mainVideoEl && !mainVideoEl.paused) {
    mainVideoEl.pause();
  }
}

function resetMainVideoUI() {
  const playBtn = document.getElementById("playBtn");
  const centerPlay = document.getElementById("centerPlay");
  const progressBar = document.getElementById("progressBar");
  if (!mainVideoEl) return;
  mainVideoEl.pause();
  mainVideoEl.currentTime = 0;
  if (playBtn) playBtn.textContent = "▶";
  if (centerPlay) centerPlay.style.display = "block";
  if (progressBar) {
    progressBar.value = 0;
    progressBar.style.setProperty("--progress-percent", "0%");
  }
}

function setMainPosterFromRealIndex(realIdx) {
  // Если хочешь менять постер большого плеера под активный слайд
  if (!mainVideoEl || !ytIds[realIdx]) return;
  mainVideoEl.poster = `https://i.ytimg.com/vi/${ytIds[realIdx]}/hqdefault.jpg`;
}

// ================== BEFORE/AFTER СЛАЙДЕР ("Picture explore") ==================
window.addEventListener("DOMContentLoaded", () => {
  const slider = document.getElementById("slider");
  const beforeWrapper = document.querySelector(".image--before-wrapper");
  const container = document.querySelector(".slider-container");

  if (slider && beforeWrapper && container) {
    let isDragging = false;

    const setPos = (percent) => {
      const p = Math.max(0, Math.min(100, percent || 0));
      beforeWrapper.style.width = `${p}%`;
      slider.style.left = `${p}%`;
    };

    const update = (e) => {
      if (!isDragging) return;
      const rect = container.getBoundingClientRect();
      const offsetX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      setPos((offsetX / rect.width) * 100);
    };

    slider.addEventListener("mousedown", () => (isDragging = true));
    document.addEventListener("mouseup", () => (isDragging = false));
    document.addEventListener("mousemove", update);

    // Touch
    slider.addEventListener("touchstart", () => (isDragging = true), {
      passive: true,
    });
    document.addEventListener("touchend", () => (isDragging = false), {
      passive: true,
    });
    document.addEventListener(
      "touchmove",
      (e) => {
        if (!isDragging) return;
        const t = e.touches[0];
        if (!t) return;
        const rect = container.getBoundingClientRect();
        const offsetX = Math.max(
          0,
          Math.min(rect.width, t.clientX - rect.left)
        );
        setPos((offsetX / rect.width) * 100);
      },
      { passive: true }
    );

    setPos(50);
  }
});

// ================== БОЛЬШОЙ КАСТОМНЫЙ ПЛЕЕР ==================
window.addEventListener("DOMContentLoaded", () => {
  const video = document.getElementById("mainVideo");
  if (!video) return;

  mainVideoEl = video;

  const playBtn = document.getElementById("playBtn");
  const muteBtn = document.getElementById("muteBtn");
  const progressBar = document.getElementById("progressBar");
  const volumeBar = document.getElementById("volumeBar");
  const fullscreenBtn = document.getElementById("fullscreenBtn");
  const centerPlay = document.getElementById("centerPlay");

  function updatePlayButtons() {
    const isPlaying = !video.paused;
    if (playBtn) playBtn.textContent = isPlaying ? "⏸" : "▶";
    if (centerPlay) centerPlay.style.display = isPlaying ? "none" : "block";
  }

  const toggleMain = () => (video.paused ? video.play() : video.pause());
  if (playBtn) playBtn.onclick = toggleMain;
  if (centerPlay) centerPlay.onclick = () => video.play();
  video.onclick = toggleMain;

  video.addEventListener("play", () => {
    pauseAllYt(); // если играет главное — стопаем все YouTube
    updatePlayButtons();
  });
  video.addEventListener("pause", updatePlayButtons);
  video.addEventListener("ended", updatePlayButtons);

  video.addEventListener("timeupdate", () => {
    if (progressBar) {
      progressBar.value = video.currentTime;
      const percent = (video.currentTime / (video.duration || 1)) * 100;
      progressBar.style.setProperty("--progress-percent", `${percent}%`);
    }
  });

  video.addEventListener("loadedmetadata", () => {
    if (progressBar) progressBar.max = video.duration || 0;
  });

  if (progressBar)
    progressBar.oninput = () => (video.currentTime = progressBar.value);

  if (muteBtn)
    muteBtn.onclick = () => {
      video.muted = !video.muted;
      muteBtn.textContent = video.muted ? "🔇" : "🔊";
    };

  if (volumeBar)
    volumeBar.oninput = () => {
      video.volume = volumeBar.value;
      video.muted = video.volume === 0;
      if (muteBtn) muteBtn.textContent = video.muted ? "🔇" : "🔊";
    };

  if (fullscreenBtn)
    fullscreenBtn.onclick = () => {
      if (!document.fullscreenElement) video.parentElement.requestFullscreen();
      else document.exitFullscreen();
    };

  updatePlayButtons();
});

// ================== КАРУСЕЛЬ: 3 видимых, скролл по 1, бесконечно ==================
const wrapper = document.querySelector(".carousel-wrapper");
const track = document.getElementById("carouselTrack");
const bulletsBox = document.getElementById("carouselBullets");
const prevBtn = document.getElementById("carouselPrev");
const nextBtn = document.getElementById("carouselNext");

const VISIBLE = 3;
let realSlides = [];
let realCount = 0;
let gapPx = 0;
let slideW = 0;
let index = 0; // индекс ЛЕВОГО видимого элемента в полном массиве (с клонами)
let fullSlides = []; // дети track ВСЕГО (реальные + клоны)

function safeCarousel() {
  return wrapper && track && bulletsBox;
}

if (safeCarousel()) {
  realSlides = Array.from(document.querySelectorAll(".carousel-slide")); // реальные (из HTML)
  realCount = realSlides.length;
  ytIds = realSlides.map((s) => s.dataset.videoId);

  function applyThumbBackgrounds(slides) {
    slides.forEach((slide) => {
      const vid = slide.dataset.videoId;
      if (!vid) return;
      slide.style.backgroundImage = `url(https://i.ytimg.com/vi/${vid}/hqdefault.jpg)`;
      slide.style.backgroundSize = "cover";
      slide.style.backgroundPosition = "center";
    });
  }

  function buildClones() {
    // клоны: VISIBLE последних -> в начало, VISIBLE первых -> в конец
    const first = realSlides.slice(0, VISIBLE).map((n) => n.cloneNode(true));
    const last = realSlides.slice(-VISIBLE).map((n) => n.cloneNode(true));
    last.forEach((n) => track.insertBefore(n, track.firstChild));
    first.forEach((n) => track.appendChild(n));
    fullSlides = Array.from(track.children);
  }

  function layoutCarousel() {
    const styles = getComputedStyle(track);
    gapPx = parseFloat(styles.columnGap || styles.gap || "0");
    const viewportW = wrapper.clientWidth;
    slideW = (viewportW - gapPx * (VISIBLE - 1)) / VISIBLE;

    fullSlides.forEach((sl) => (sl.style.flex = `0 0 ${slideW}px`));
    setTranslateByIndex(false);
  }

  function setTranslateByIndex(withAnim = true) {
    const dx = index * (slideW + gapPx);
    track.style.transition = withAnim ? "transform 0.5s ease" : "none";
    track.style.transform = `translateX(-${dx}px)`;
  }

  function realLeftIndex() {
    // индекс реального левого слайда в диапазоне [0..realCount-1]
    return (index - VISIBLE + realCount) % realCount;
  }

  function realCenterIndex() {
    return (realLeftIndex() + 1) % realCount; // средний из трёх
  }

  function buildBullets() {
    bulletsBox.innerHTML = "";
    for (let i = 0; i < realCount; i++) {
      const dot = document.createElement("span");
      if (i === realCenterIndex()) dot.classList.add("active");
      dot.addEventListener("click", () => {
        // навигация → останавливаем всё
        pauseAllYt();
        pauseMainVideo();
        resetMainVideoUI();

        // ставим левый индекс так, чтобы центр стал выбранным i
        const left = (i - 1 + realCount) % realCount;
        index = left + VISIBLE;
        setTranslateByIndex(true);
        highlightBullet();
        setMainPosterFromRealIndex(realCenterIndex());
      });
      bulletsBox.appendChild(dot);
    }
  }

  function highlightBullet() {
    [...bulletsBox.children].forEach((b, i) =>
      b.classList.toggle("active", i === realCenterIndex())
    );
  }

  function go(step) {
    // навигация → останавливаем всё
    pauseAllYt();
    pauseMainVideo();
    resetMainVideoUI();

    index += step;
    setTranslateByIndex(true);
    highlightBullet();
    setMainPosterFromRealIndex(realCenterIndex());
  }

  // Бесконечность: корректируем индекс по окончании анимации
  track.addEventListener("transitionend", () => {
    // вышли справа за реальные?
    if (index >= realCount + VISIBLE) {
      index -= realCount;
      setTranslateByIndex(false); // без анимации подменяем позицию
      requestAnimationFrame(
        () => (track.style.transition = "transform 0.5s ease")
      );
    }
    // ушли влево за реальные?
    if (index < VISIBLE) {
      index += realCount;
      setTranslateByIndex(false);
      requestAnimationFrame(
        () => (track.style.transition = "transform 0.5s ease")
      );
    }
  });

  prevBtn?.addEventListener("click", () => go(-1));
  nextBtn?.addEventListener("click", () => go(+1));

  window.addEventListener("load", () => {
    applyThumbBackgrounds(realSlides);
    buildClones();
    index = VISIBLE; // стартовая позиция: первый реальный слева
    layoutCarousel();
    buildBullets();
    highlightBullet();
  });
  window.addEventListener("resize", layoutCarousel);
}

// ================== YOUTUBE API: создаём плееры ТОЛЬКО для реальных слайдов ==================
window.onYouTubeIframeAPIReady = function () {
  if (!realSlides || !realSlides.length) return;

  realSlides.forEach((slide, i) => {
    const box = document.createElement("div");
    box.style.position = "relative";
    box.style.width = "100%";
    box.style.height = "100%";
    slide.appendChild(box);

    const hostId = `yt-real-${i}`;
    const host = document.createElement("div");
    host.id = hostId;
    box.appendChild(host);

    const player = new YT.Player(hostId, {
      width: "100%",
      height: "100%",
      videoId: ytIds[i],
      playerVars: { rel: 0, modestbranding: 1 },
      events: {
        onStateChange: (e) => {
          // при запуске любого YT — глушим главное и остальные YT
          if (e.data === YT.PlayerState.PLAYING) {
            pauseMainVideo();
            pauseAllYt(i);
          }
          // подсветка/оверлей
          if (overlay) {
            const playing = e.data === YT.PlayerState.PLAYING;
            overlay.style.opacity = playing ? "0" : "1";
            overlay.style.pointerEvents = playing ? "none" : "auto";
          }
        },
      },
    });

    // Оверлей Play/Toggle на всю карточку
    const overlay = document.createElement("button");
    Object.assign(overlay.style, {
      position: "absolute",
      inset: "0",
      display: "grid",
      placeItems: "center",
      background: "transparent",
      border: "none",
      cursor: "pointer",
      transition: "opacity .2s ease",
      color: "white",
      fontSize: "48px",
      textShadow: "0 2px 8px rgba(0,0,0,.6)",
    });
    overlay.setAttribute("aria-label", "Play/Pause");
    overlay.innerText = "▶";
    overlay.addEventListener("click", () => {
      const st = player.getPlayerState();
      if (st === YT.PlayerState.PLAYING) {
        player.pauseVideo();
      } else {
        pauseMainVideo(); // не даём играть двум типам сразу
        pauseAllYt(i);
        player.playVideo();
      }
    });
    box.appendChild(overlay);

    ytPlayers.push(player);
  });
};

// ================== GALLERY: анимация появления ==================
const galleryImages = document.querySelectorAll(".gallery-item");
if (galleryImages.length) {
  const galleryObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add("visible");
        else entry.target.classList.remove("visible");
      });
    },
    { threshold: 0.4 }
  );
  galleryImages.forEach((img) => galleryObserver.observe(img));

  window.addEventListener("load", () => {
    galleryImages.forEach((img) => {
      const r = img.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0)
        img.classList.add("visible");
    });
  });
}

// ================== LEAFLET MAP (CONTACTS) ==================
(function initContactsMap() {
  const host = document.querySelector(".contacts__map");
  if (!host) return;

  // Центр — пирамида Лувра (как в макете)
  const center = [48.860611, 2.337644];

  const map = L.map(host, {
    center,
    zoom: 17,
    scrollWheelZoom: false, // чтобы скроллом не прилипать
    zoomControl: true,
  });

  // Светло‑серый стиль, близкий к макету
  L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    {
      attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
      maxZoom: 20,
    }
  ).addTo(map);

  // На случай асинхронной отрисовки
  setTimeout(() => map.invalidateSize(), 150);

  // SVG «капля» — делаем divIcon c inline‑SVG, чтобы легко перекрашивать классами
  const makePin = (cls = "") =>
    L.divIcon({
      className: "",
      iconSize: [26, 26],
      iconAnchor: [13, 26], // «носик» указывает на точку
      popupAnchor: [0, -24],
      html: `
        <svg class="map-pin ${cls}" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 23c-.3 0-.6-.1-.8-.3C9 20.9 4 15.6 4 10.5 4 5.8 7.8 2 12.5 2S21 5.8 21 10.5c0 5.1-5 10.4-7.2 12.2-.2.2-.5.3-.8.3z"
                transform="translate(-1.5 -1.5)"
                fill="var(--pin-fill)" stroke="var(--pin-stroke)" stroke-width="2"/>
          <circle cx="12" cy="10" r="3" fill="#fff" opacity=".85"/>
        </svg>`,
    });

  const primaryIcon = makePin("primary");
  const secondaryIcon = makePin();

  // === Точки «как на скрине» (координаты можно легко подправить) ===
  const points = [
    // главный маркер — центр/пирамида
    {
      name: "Musée du Louvre — Pyramid",
      coords: [48.860611, 2.337644],
      icon: primaryIcon,
    },

    // правый верх (вдоль rue de Rivoli / крыло Ришельё)
    {
      name: "Entrée Richelieu",
      coords: [48.86195, 2.33651],
      icon: secondaryIcon,
    },

    // правее‑ниже (внутри двора у павильона)
    { name: "Cour Napoléon", coords: [48.86098, 2.33672], icon: secondaryIcon },

    // левее‑верх (Palais Royal – Musée du Louvre, M1/M7)
    {
      name: "Palais Royal – Musée du Louvre (M)",
      coords: [48.86205, 2.3359],
      icon: secondaryIcon,
    },
  ];

  points.forEach((p) => {
    L.marker(p.coords, { icon: p.icon }).addTo(map).bindPopup(p.name);
  });

  // Если захочешь автоподгонку под все маркеры — раскомментируй:
  // const group = L.featureGroup(points.map(p => L.marker(p.coords)));
  // map.fitBounds(group.getBounds().pad(0.2));
})();
