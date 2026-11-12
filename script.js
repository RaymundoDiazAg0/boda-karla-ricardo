/* ========================================================================
   INVITACIÓN DE BODA — INTERACCIONES (ETAPA 2)
   Archivo: script.js | Sin librerías externas.

   PERSONALIZA SOLO ESTE BLOQUE AL PRINCIPIO:
   - RSVP: "demo", "whatsapp" o "api" (lee GUIA-SCRIPT.md).
   - Música: agrega assets/musica.mp3 y cambia enabled a true.
   - Fecha: cambia data-wedding-date en index.html, NO aquí.

   IMPORTANTE: en modo "demo" NO se guarda ni envía ningún dato.
   En "whatsapp" el invitado debe enviar el mensaje manualmente.
   En "api" se necesita un servidor real que confirme el guardado.
   ======================================================================== */

(() => {
  "use strict";

  const CONFIG = {
    rsvp: {
      mode: "demo",             // "demo" | "whatsapp" | "api"
      whatsappNumber: "",       // p. ej. "5215512345678" (sin + ni espacios)
      endpoint: "",             // URL de TU backend que acepte POST JSON y CORS
      maxGuests: 4,             // número máximo de pases de esta invitación
    },
    music: {
      enabled: false,           // cambia a true después de subir tu MP3
      src: "assets/musica.mp3",
      volume: 0.45,             // valor entre 0 y 1
    },
    calendar: {
      title: "Boda de Olivia y Adrián", // sustituye nombres de ejemplo
      location: "Oaxaca, México",       // sustituye ubicación de ejemplo
      durationHours: 6,
    },
  };

  /* --- 1. CUENTA REGRESIVA -------------------------------------------- */
  function initCountdown() {
    const container = document.querySelector("#countdown");
    if (!container) return;

    const dateText = container.dataset.weddingDate || "";
    const eventDate = new Date(dateText);
    const units = {
      days: container.querySelector('[data-count="days"]'),
      hours: container.querySelector('[data-count="hours"]'),
      minutes: container.querySelector('[data-count="minutes"]'),
      seconds: container.querySelector('[data-count="seconds"]'),
    };

    if (Number.isNaN(eventDate.getTime()) || Object.values(units).some(el => !el)) {
      console.warn("Invitación: revisa la fecha de #countdown (data-wedding-date).");
      return;
    }

    let interval;
    const update = () => {
      const secondsRemaining = Math.max(0, Math.floor((eventDate.getTime() - Date.now()) / 1000));
      const days = Math.floor(secondsRemaining / 86400);
      const hours = Math.floor((secondsRemaining % 86400) / 3600);
      const minutes = Math.floor((secondsRemaining % 3600) / 60);
      const seconds = secondsRemaining % 60;

      units.days.textContent = String(days).padStart(2, "0");
      units.hours.textContent = String(hours).padStart(2, "0");
      units.minutes.textContent = String(minutes).padStart(2, "0");
      units.seconds.textContent = String(seconds).padStart(2, "0");

      if (secondsRemaining === 0) {
        clearInterval(interval);
        container.classList.add("countdown--finished");
        container.setAttribute("aria-label", "¡Llegó el gran día de nuestra boda!");
        const heading = document.querySelector("#countdown-heading");
        if (heading) heading.textContent = "¡Llegó nuestro gran día!";
      }
    };

    update();
    if (eventDate.getTime() > Date.now()) {
      interval = window.setInterval(update, 1000);
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) update();
      });
    }
  }

  /* --- 2. ANIMACIONES DISCRETAS AL DESPLAZARSE ------------------------ */
  function initScrollAnimations() {
    const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || !("IntersectionObserver" in window)) return;

    const items = Array.from(document.querySelectorAll([
      ".introduction__copy", ".introduction__photo",
      ".save-date .date-lockup", ".venue-card",
      ".accommodation__image", ".accommodation__info",
      ".moments__photo", ".timeline__item",
      ".dresscode__frame", ".gift-option", ".socials",
      ".rsvp__card", ".help",
    ].join(",")));

    if (!items.length) return;

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -30px 0px" });

    items.forEach((el, index) => {
      el.classList.add("reveal");
      el.style.setProperty("--reveal-delay", `${(index % 3) * 75}ms`);
      observer.observe(el);
    });
    document.documentElement.classList.add("js-motion");
  }

  /* --- 3. REPRODUCTOR DE MÚSICA (SOLO CON CLIC DEL INVITADO) ---------- */
  function initMusic() {
    const button = document.querySelector(".music-control");
    const audio = document.querySelector("#wedding-music");
    if (!button || !audio) return;

    const enabled = CONFIG.music.enabled && Boolean(CONFIG.music.src.trim());
    if (!enabled) {
      button.disabled = true;
      button.title = "Activa la música desde script.js cuando agregues el MP3";
      button.setAttribute("aria-label", "Música no configurada");
      return;
    }

    audio.src = CONFIG.music.src;
    audio.loop = true;
    audio.volume = Math.min(1, Math.max(0, CONFIG.music.volume));
    button.disabled = false;
    button.removeAttribute("aria-disabled");
    button.setAttribute("aria-pressed", "false");

    const syncButton = () => {
      const playing = !audio.paused;
      button.classList.toggle("is-playing", playing);
      button.setAttribute("aria-pressed", String(playing));
      button.setAttribute("aria-label", playing ? "Pausar música" : "Reproducir música");
      button.title = playing ? "Pausar música" : "Reproducir música";
    };

    button.addEventListener("click", async () => {
      if (!audio.paused) {
        audio.pause();
        syncButton();
        return;
      }
      try {
        await audio.play(); // los navegadores requieren un gesto del usuario
      } catch (error) {
        console.warn("No se pudo reproducir el MP3:", error);
        button.title = "No se pudo reproducir; comprueba assets/musica.mp3";
        button.setAttribute("aria-label", "No se pudo reproducir la música");
      }
      syncButton();
    });
    audio.addEventListener("play", syncButton);
    audio.addEventListener("pause", syncButton);
    audio.addEventListener("error", () => {
      audio.pause();
      button.title = "No se encontró el archivo de música";
      button.setAttribute("aria-label", "Archivo de música no disponible");
      button.classList.remove("is-playing");
    });
    syncButton();
  }

  /* --- 4. RSVP: VALIDACIÓN + 3 MODOS DE ENTREGA ----------------------- */
  function initRsvp() {
    const form = document.querySelector("#rsvp-form");
    if (!form) return;

    const nameInput = form.querySelector("#guest-name");
    const countSelect = form.querySelector("#guest-count");
    const messageInput = form.querySelector("#guest-message");
    const attendanceInputs = Array.from(form.querySelectorAll('input[name="attendance"]'));
    const submitButton = form.querySelector('button[type="submit"]');
    const notice = form.querySelector(".rsvp-form__pending");
    const feedback = form.querySelector("#rsvp-feedback");
    if (!nameInput || !countSelect || !messageInput || !submitButton || !feedback) return;

    // ?pases=2 personaliza el límite visible por enlace; el backend debe
    // verificarlo por su cuenta: la URL NO constituye un control de seguridad.
    const defaultMax = Math.max(1, Math.min(4, Math.trunc(CONFIG.rsvp.maxGuests) || 1));
    const rawPasses = new URLSearchParams(window.location.search).get("pases");
    const requestedPasses = rawPasses && /^[1-4]$/.test(rawPasses) ? Number(rawPasses) : defaultMax;
    const maxGuests = Math.min(defaultMax, requestedPasses);
    Array.from(countSelect.options).forEach(option => {
      if (Number(option.value) > maxGuests) option.remove();
    });
    countSelect.value = "1";

    const mode = CONFIG.rsvp.mode;
    const hasWhatsApp = /^\d{10,15}$/.test(CONFIG.rsvp.whatsappNumber);
    const hasApi = /^https:\/\//i.test(CONFIG.rsvp.endpoint);
    const ready = mode === "demo" || (mode === "whatsapp" && hasWhatsApp) || (mode === "api" && hasApi);

    submitButton.disabled = !ready;
    submitButton.setAttribute("aria-disabled", String(!ready));
    if (mode === "demo") {
      submitButton.textContent = "Ver resumen de confirmación";
      if (notice) notice.textContent = "Modo de prueba: no se enviarán ni guardarán respuestas.";
    } else if (mode === "whatsapp") {
      submitButton.textContent = "Preparar mensaje de WhatsApp";
      if (notice) notice.textContent = ready ? "Se abrirá WhatsApp. Tendrás que pulsar Enviar para confirmar." : "Configura tu número de WhatsApp en script.js para activar el RSVP.";
    } else if (mode === "api") {
      submitButton.textContent = "Confirmar asistencia";
      if (notice) notice.textContent = ready ? "Tu confirmación se enviará de forma segura al servidor configurado." : "Agrega la URL HTTPS de tu servidor en script.js para activar el RSVP.";
    } else {
      if (notice) notice.textContent = "Modo de RSVP no reconocido. Revísalo en script.js.";
    }

    const attendanceValue = () => attendanceInputs.find(input => input.checked)?.value || "";
    const syncAttendance = () => {
      const attends = attendanceValue() === "si";
      countSelect.disabled = !attends;
      countSelect.closest(".field")?.classList.toggle("is-inactive", !attends);
    };
    syncAttendance();

    const showFeedback = (text, success = false) => {
      feedback.textContent = text; // evita insertar HTML de usuarios
      feedback.classList.toggle("is-success", success);
    };
    nameInput.addEventListener("input", () => {
      nameInput.removeAttribute("aria-invalid");
      showFeedback("");
    });
    attendanceInputs.forEach(input => input.addEventListener("change", () => {
      syncAttendance();
      showFeedback("");
    }));
    countSelect.addEventListener("change", () => showFeedback(""));

    form.addEventListener("submit", async event => {
      event.preventDefault();
      if (!ready) return;

      const guestName = nameInput.value.trim().replace(/\s+/g, " ");
      const attendance = attendanceValue();
      const guests = attendance === "si" ? Number(countSelect.value) : 0;
      const message = messageInput.value.trim();

      if (guestName.length < 2) {
        nameInput.setAttribute("aria-invalid", "true");
        showFeedback("Escribe tu nombre completo para continuar.");
        nameInput.focus();
        return;
      }
      if (!attendance) {
        showFeedback("Selecciona si podrás acompañarnos o no.");
        attendanceInputs[0]?.focus();
        return;
      }
      if (attendance === "si" && (!Number.isInteger(guests) || guests < 1 || guests > maxGuests)) {
        showFeedback(`Selecciona una cantidad válida (máximo ${maxGuests}).`);
        countSelect.focus();
        return;
      }

      const payload = {
        guest_name: guestName,
        attendance,
        guest_count: guests,
        message,
        wedding_date: document.querySelector("#countdown")?.dataset.weddingDate || "",
        submitted_at: new Date().toISOString(),
      };

      if (mode === "demo") {
        const status = attendance === "si" ? `asistirá con ${guests} ${guests === 1 ? "persona" : "personas"}` : "no podrá asistir";
        showFeedback(`Vista previa: ${guestName} ${status}. ${message ? `Mensaje: “${message}”. ` : ""}Esta respuesta NO se ha enviado ni guardado.`, true);
        return;
      }

      if (mode === "whatsapp") {
        const response = attendance === "si" ? "Sí asistiré" : "No podré asistir";
        const text = [
          `Hola, quiero confirmar mi asistencia a la boda.`,
          `Nombre: ${guestName}`,
          `Asistencia: ${response}`,
          `Personas: ${guests}`,
          ...(message ? [`Mensaje: ${message}`] : []),
        ].join("\n");
        const url = `https://wa.me/${CONFIG.rsvp.whatsappNumber}?text=${encodeURIComponent(text)}`;
        // El clic solo ABRE WhatsApp: no puede verificar el envío final.
        const link = document.createElement("a");
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        document.body.appendChild(link);
        link.click();
        link.remove();
        showFeedback("Se preparó tu mensaje para WhatsApp. Si tu navegador lo abrió, pulsa Enviar allí; esta página no ha registrado tu respuesta.", true);
        return;
      }

      // Para usar "api", tu servidor debe habilitar CORS, validar los pases,
      // guardar la respuesta y devolver JSON { "ok": true }.
      submitButton.disabled = true;
      submitButton.textContent = "Enviando...";
      showFeedback("");
      try {
        const response = await fetch(CONFIG.rsvp.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = await response.json();
        if (!response.ok || result?.ok !== true) {
          throw new Error("El servidor no confirmó el registro.");
        }
        showFeedback("¡Gracias! Tu respuesta quedó registrada correctamente.", true);
        form.reset();
        syncAttendance();
      } catch (error) {
        console.error("No se pudo completar el RSVP:", error);
        showFeedback("No pudimos guardar tu respuesta. Inténtalo de nuevo en unos momentos.");
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Confirmar asistencia";
      }
    });
  }

  /* --- 5. GUARDAR FECHA (.ICS COMPATIBLE CON CALENDARIOS) ------------- */
  function initAddToCalendar() {
    const button = document.querySelector("#add-to-calendar");
    const countdown = document.querySelector("#countdown");
    if (!button || !countdown) return;

    const start = new Date(countdown.dataset.weddingDate || "");
    if (Number.isNaN(start.getTime())) {
      button.disabled = true;
      return;
    }
    const end = new Date(start.getTime() + CONFIG.calendar.durationHours * 3600000);
    const stamp = date => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    const escapeIcs = value => String(value).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");

    button.addEventListener("click", () => {
      const lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Invitacion de boda//ES",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "BEGIN:VEVENT",
        `UID:boda-${stamp(start)}@invitacion.local`,
        `DTSTAMP:${stamp(new Date())}`,
        `DTSTART:${stamp(start)}`,
        `DTEND:${stamp(end)}`,
        `SUMMARY:${escapeIcs(CONFIG.calendar.title)}`,
        `LOCATION:${escapeIcs(CONFIG.calendar.location)}`,
        `DESCRIPTION:${escapeIcs("¡Acompáñanos a celebrar nuestra boda!")}`,
        "END:VEVENT",
        "END:VCALENDAR",
      ];
      const blob = new Blob([lines.join("\r\n") + "\r\n"], { type: "text/calendar;charset=utf-8" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = "guardar-fecha-boda.ics";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }

  /* --- INICIALIZAR ---------------------------------------------------- */
  function main() {
    initCountdown();
    initScrollAnimations();
    initMusic();
    initRsvp();
    initAddToCalendar();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", main, { once: true });
  } else {
    main();
  }
})();
