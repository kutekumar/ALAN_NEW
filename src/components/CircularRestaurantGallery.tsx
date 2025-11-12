import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

type GalleryItem = {
  id: string;
  image: string | null;
  title: string;
};

type CircularRestaurantGalleryProps = {
  restaurants: GalleryItem[];
};

function CircularRestaurantGallery({ restaurants }: CircularRestaurantGalleryProps) {
  const navigate = useNavigate();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const velocityRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  const galleryItems = (restaurants || [])
    .filter((r) => r.image)
    .slice(0, 20);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || galleryItems.length === 0) return;

    let isDown = false;
    let startX = 0;
    let scrollStart = 0;
    let lastX = 0;
    let lastTime = 0;
    let autoDir: 1 | -1 = 1; // 1 = move right, -1 = move left
    let lastAutoTime = performance.now();

    const getMaxScroll = () => track.scrollWidth - track.clientWidth;

    const clampScroll = () => {
      const max = getMaxScroll();
      if (track.scrollLeft < 0) track.scrollLeft = 0;
      if (track.scrollLeft > max) track.scrollLeft = max;
    };

    const stopMomentum = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };

    const step = () => {
      const trackEl = trackRef.current;
      if (!trackEl) {
        rafRef.current = null;
        return;
      }

      const now = performance.now();
      const dt = now - lastAutoTime;
      lastAutoTime = now;

      // apply existing drag momentum if any
      let velocity = velocityRef.current;
      if (Math.abs(velocity) >= 0.02) {
        trackEl.scrollLeft += velocity;
        clampScroll();
        velocity *= 0.95;
        velocityRef.current = velocity;
      } else {
        velocityRef.current = 0;

        // subtle yo-yo auto scroll when idle (no drag)
        if (!isDown) {
          const max = getMaxScroll();
          if (max > 0) {
            const baseSpeed = 0.02; // very subtle
            const delta = baseSpeed * dt * autoDir;
            trackEl.scrollLeft += delta;

            if (trackEl.scrollLeft <= 0) {
              trackEl.scrollLeft = 0;
              autoDir = 1;
            } else if (trackEl.scrollLeft >= max) {
              trackEl.scrollLeft = max;
              autoDir = -1;
            }
          }
        }
      }

      rafRef.current = requestAnimationFrame(step);
    };

    // start animation loop once on mount / effect run
    stopMomentum();
    lastAutoTime = performance.now();
    rafRef.current = requestAnimationFrame(step);

    const onMouseDown = (e: MouseEvent) => {
      isDown = true;
      stopMomentum();
      startX = e.pageX;
      lastX = e.pageX;
      scrollStart = track.scrollLeft;
      lastTime = performance.now();
      track.classList.add('cursor-grabbing');
    };

    const endDrag = (x: number | null) => {
      if (!isDown) return;
      isDown = false;
      track.classList.remove('cursor-grabbing');
      clampScroll();

      if (x !== null) {
        const now = performance.now();
        const deltaX = x - lastX;
        const deltaTime = now - lastTime || 1;
        // velocity: negative deltaX scrolls right, positive scrolls left
        let velocity = -(deltaX / deltaTime) * 12;
        if (velocity > 40) velocity = 40;
        if (velocity < -40) velocity = -40;
        velocityRef.current = velocity;
        // animation loop already running; momentum handled there
      }
    };

    const onMouseUpOrLeave = (e: MouseEvent) => {
      endDrag(e.pageX);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDown) return;
      e.preventDefault();
      const dx = e.pageX - startX;
      track.scrollLeft = scrollStart - dx;

      // track last position/time for velocity
      const now = performance.now();
      lastX = e.pageX;
      lastTime = now;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (!e.touches[0]) return;
      isDown = true;
      stopMomentum();
      const touchX = e.touches[0].pageX;
      startX = touchX;
      lastX = touchX;
      scrollStart = track.scrollLeft;
      lastTime = performance.now();
    };

    const onTouchEnd = (e: TouchEvent) => {
      const touchX = e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].pageX : null;
      endDrag(touchX);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isDown || !e.touches[0]) return;
      const touchX = e.touches[0].pageX;
      const dx = touchX - startX;
      track.scrollLeft = scrollStart - dx;

      const now = performance.now();
      lastX = touchX;
      lastTime = now;
    };

    track.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUpOrLeave);
    track.addEventListener('mouseleave', onMouseUpOrLeave);
    track.addEventListener('mousemove', onMouseMove);

    track.addEventListener('touchstart', onTouchStart, { passive: true });
    track.addEventListener('touchend', onTouchEnd);
    track.addEventListener('touchcancel', onTouchEnd);
    track.addEventListener('touchmove', onTouchMove, { passive: false });

    return () => {
      track.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUpOrLeave);
      track.removeEventListener('mouseleave', onMouseUpOrLeave);
      track.removeEventListener('mousemove', onMouseMove);

      track.removeEventListener('touchstart', onTouchStart);
      track.removeEventListener('touchend', onTouchEnd);
      track.removeEventListener('touchcancel', onTouchEnd);
      track.removeEventListener('touchmove', onTouchMove);
      stopMomentum();
    };
  }, [galleryItems.length]);

  if (galleryItems.length === 0) return null;

  return (
    <div className="w-full mt-3 mb-4">
      <div
        ref={trackRef}
        className="
          mx-auto max-w-md px-4 flex gap-5 overflow-x-auto select-none
          snap-x snap-mandatory cursor-grab no-scrollbar
        "
        style={{
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {galleryItems.map((item) => (
          <button
            key={item.id}
            onClick={() => navigate(`/restaurant/${item.id}`)}
            className="relative flex-shrink-0 snap-start group"
            style={{ scrollSnapAlign: 'start' }}
          >
            <div
              className="
                w-20 h-20 rounded-full overflow-hidden
                bg-black/70 border border-yellow-500/40
                transition-transform duration-300 ease-out
                group-active:scale-95 group-hover:scale-[1.03]
              "
            >
              <img
                src={item.image || undefined}
                alt={item.title}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
            <div className="mt-1.5 w-20 text-center">
              <span className="text-[9px] font-semibold text-black block truncate">
                {item.title}
              </span>
            </div>
          </button>
        ))}
      </div>
      <style>
        {`
          .no-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
          .no-scrollbar::-webkit-scrollbar {
            display: none;
          }
        `}
      </style>
    </div>
  );
}

export default CircularRestaurantGallery;