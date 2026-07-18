/**
 * LUMEN — "The Universe Awaits"
 * -------------------------------------------------------------------------
 * Vanilla JS, no dependencies. Organized as small independent modules that
 * each own one feature and expose an init() function. main() wires them up
 * once the DOM is ready, respecting prefers-reduced-motion where relevant.
 * -------------------------------------------------------------------------
 * Contents:
 *   1. Utilities
 *   2. Loading screen
 *   3. Dynamic navbar
 *   4. Smooth scroll (data-scroll-to)
 *   5. Intersection Observer reveal animations
 *   6. Animated counters
 *   7. Custom cursor
 *   8. Particle starfield (canvas)
 *   9. Parallax effects (data-parallax)
 *  10. Constellation scroll progress
 *  11. Join form
 *  12. Bootstrapping
 */

(() => {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const lerp = (start, end, t) => start + (end - start) * t;
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  function rafThrottle(fn) {
    let ticking = false;
    return (...args) => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        fn(...args);
        ticking = false;
      });
    };
  }

  function initLoader() {
    const loader = $('#loader');
    const fill = $('#loaderFill');
    if (!loader) return Promise.resolve();

    return new Promise((resolve) => {
      let progress = 0;
      const tick = () => {
        progress += (100 - progress) * 0.12;
        fill.style.width = `${Math.min(progress, 99)}%`;
        if (progress < 99.5) {
          requestAnimationFrame(tick);
        }
      };
      requestAnimationFrame(tick);

      window.addEventListener('load', () => {
        fill.style.width = '100%';
        setTimeout(() => {
          loader.classList.add('is-hidden');
          document.body.style.overflow = '';
          resolve();
        }, 400);
      }, { once: true });
    });
  }


  function initNavbar() {
    const navbar = $('#navbar');
    if (!navbar) return;

    const onScroll = rafThrottle(() => {
      navbar.classList.toggle('is-scrolled', window.scrollY > 40);
    });

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }


  function initSmoothScroll() {
    $$('[data-scroll-to]').forEach((el) => {
      el.addEventListener('click', () => {
        const target = $(el.getAttribute('data-scroll-to'));
        if (!target) return;
        target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
      });
    });

    $$('a[href^="#"]').forEach((link) => {
      link.addEventListener('click', (e) => {
        const id = link.getAttribute('href');
        if (id.length <= 1) return;
        const target = $(id);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
      });
    });
  }


  function initReveals() {
    const targets = $$('.reveal');
    if (!targets.length) return;

    if (!('IntersectionObserver' in window)) {
      targets.forEach((el) => el.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -60px 0px' }
    );

    targets.forEach((el) => observer.observe(el));
  }


  function initCounters() {
    const counters = $$('[data-counter]');
    if (!counters.length) return;

    const animateCounter = (el) => {
      const target = parseFloat(el.getAttribute('data-target'));
      const suffix = el.getAttribute('data-suffix') || '';
      const duration = 1800;
      const start = performance.now();

      const easeOutExpo = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

      const step = (now) => {
        const elapsed = now - start;
        const t = clamp(elapsed / duration, 0, 1);
        const eased = easeOutExpo(t);
        const value = target * eased;
        const display = target % 1 === 0 ? Math.round(value).toLocaleString() : value.toFixed(1);
        el.textContent = `${display}${suffix}`;
        if (t < 1) requestAnimationFrame(step);
      };

      requestAnimationFrame(step);
    };

    if (!('IntersectionObserver' in window)) {
      counters.forEach(animateCounter);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.4 }
    );

    counters.forEach((el) => observer.observe(el));
  }


  function initCursor() {
    const cursor = $('#cursor');
    if (!cursor || prefersReducedMotion) return;
    if (window.matchMedia('(hover: none)').matches) return;

    const trail = $('.cursor__trail', cursor);
    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let trailX = targetX;
    let trailY = targetY;

    window.addEventListener('mousemove', (e) => {
      targetX = e.clientX;
      targetY = e.clientY;
      document.documentElement.style.setProperty('--cursor-x', `${targetX}px`);
      document.documentElement.style.setProperty('--cursor-y', `${targetY}px`);
    });

    $$('a, button, input').forEach((el) => {
      el.addEventListener('mouseenter', () => cursor.classList.add('is-active'));
      el.addEventListener('mouseleave', () => cursor.classList.remove('is-active'));
    });

    const animateTrail = () => {
      trailX = lerp(trailX, targetX, 0.15);
      trailY = lerp(trailY, targetY, 0.15);
      trail.style.transform = `translate3d(${trailX - targetX}px, ${trailY - targetY}px, 0)`;
      requestAnimationFrame(animateTrail);
    };
    requestAnimationFrame(animateTrail);
  }


  function initParticleField() {
    const canvas = $('#particleField');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let width, height, dpr;
    let stars = [];
    let scrollOffset = 0;

    const STAR_DENSITY = 0.00012; 

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seedStars();
    }

    function seedStars() {
      const count = Math.round(width * height * STAR_DENSITY);
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 1.4 + 0.3,
        baseAlpha: Math.random() * 0.6 + 0.3,
        twinkleSpeed: Math.random() * 0.015 + 0.005,
        twinklePhase: Math.random() * Math.PI * 2,
        depth: Math.random() * 0.6 + 0.2, 
        driftX: (Math.random() - 0.5) * 0.04,
      }));
    }

    function draw(time) {
      ctx.clearRect(0, 0, width, height);

      for (const star of stars) {
        star.twinklePhase += star.twinkleSpeed;
        const twinkle = (Math.sin(star.twinklePhase) + 1) / 2;
        const alpha = star.baseAlpha * (0.5 + twinkle * 0.5);

        star.x += star.driftX;
        if (star.x < 0) star.x = width;
        if (star.x > width) star.x = 0;

        const parallaxY = (scrollOffset * star.depth * 0.08) % height;
        let y = star.y - parallaxY;
        if (y < 0) y += height;
        if (y > height) y -= height;

        ctx.beginPath();
        ctx.arc(star.x, y, star.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(245, 243, 255, ${alpha})`;
        ctx.fill();
      }

      if (!prefersReducedMotion) {
        requestAnimationFrame(draw);
      }
    }

    window.addEventListener('resize', rafThrottle(resize));
    window.addEventListener('scroll', rafThrottle(() => {
      scrollOffset = window.scrollY;
    }), { passive: true });

    resize();
    requestAnimationFrame(draw);
    if (prefersReducedMotion) draw(0); 
  }


  function initParallax() {
    if (prefersReducedMotion) return;
    const layers = $$('[data-parallax]');
    if (!layers.length) return;

    const update = () => {
      const scrollY = window.scrollY;
      layers.forEach((el) => {
        const speed = parseFloat(el.getAttribute('data-parallax')) || 0.1;
        const offset = scrollY * speed;
        el.style.transform = `translate3d(0, ${offset}px, 0)`;
      });
    };

    window.addEventListener('scroll', rafThrottle(update), { passive: true });
    update();
  }


  function initConstellationProgress() {
    const svg = $('#constellationProgress');
    const line = $('#constellationLine');
    const dotsGroup = $('#constellationDots');
    if (!svg || !line || !dotsGroup) return;

    const DOT_COUNT = 6;
    const viewHeight = 400;
    const dots = [];

    for (let i = 0; i < DOT_COUNT; i++) {
      const y = (viewHeight / (DOT_COUNT - 1)) * i;
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', '20');
      circle.setAttribute('cy', String(y));
      circle.setAttribute('r', '4');
      dotsGroup.appendChild(circle);
      dots.push({ el: circle, y });
    }

    const update = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollable > 0 ? clamp(window.scrollY / scrollable, 0, 1) : 0;
      const y2 = progress * viewHeight;

      line.setAttribute('y2', String(y2));

      dots.forEach((dot) => {
        dot.el.classList.toggle('is-lit', y2 >= dot.y - 2);
      });
    };

    window.addEventListener('scroll', rafThrottle(update), { passive: true });
    window.addEventListener('resize', rafThrottle(update));
    update();
  }


  function initJoinForm() {
    const form = $('#joinForm');
    const note = $('#joinNote');
    if (!form || !note) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = $('#joinEmail').value.trim();
      if (!email) return;
      note.textContent = `You're on the list — Lumen's next field notes go to ${email}.`;
      form.reset();
    });
  }


  function main() {
    document.body.style.overflow = 'hidden'; // hold scroll behind the loader

    initNavbar();
    initSmoothScroll();
    initReveals();
    initCounters();
    initCursor();
    initParticleField();
    initParallax();
    initConstellationProgress();
    initJoinForm();
    initLoader();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }
})();
