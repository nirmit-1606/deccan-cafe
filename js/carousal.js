document.addEventListener('DOMContentLoaded', function () {
    const container = document.querySelector('.menu-carousal');
    if (!container) return;
    const track = container.querySelector('.carousal-track');
    if (!track) return;

    // capture the initial item set once (the first visible sequence)
    const originals = Array.from(track.children);

    // ensure we don't loop forever per invocation — local safety cap
    function ensureTrackLength() {
        const containerWidth = container.clientWidth || 0;

        // If not enough width, clone until we have at least two viewport-widths of content
        if (track.scrollWidth < containerWidth * 2) {
            let safety = 0;
            const maxSafety = 20; // clones-per-call cap
            while (track.scrollWidth < containerWidth * 2 && safety < maxSafety) {
                originals.forEach(node => track.appendChild(node.cloneNode(true)));
                safety++;
            }
        }
    }

    function startAnimation() {
        ensureTrackLength();
        // requestAnimationFrame to ensure layout has run. Small timeout helps when
        // external images/SVGs still need to size on mobile browsers.
        requestAnimationFrame(() => setTimeout(() => {
            track.style.animation = `carousal-scroll var(--scroll-duration, 40s) linear infinite`;
            track.style.animationPlayState = 'running';
        }, 50));
    }

    // run animation after full load so external assets (object/svg/img) are sized
    if (document.readyState === 'complete') {
        startAnimation();
    } else {
        window.addEventListener('load', startAnimation, { once: true });
        window.addEventListener('resize', startAnimation);
    }

    // optional: pause animation on hover for better UX
    container.addEventListener('mouseenter', () => {
        track.style.animationPlayState = 'paused';
    });
    container.addEventListener('mouseleave', () => {
        track.style.animationPlayState = 'running';
    });
});