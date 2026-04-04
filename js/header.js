document.addEventListener("DOMContentLoaded", () => {
    const header = document.querySelector("header");
    const content = document.querySelector("main");
    const btn = document.getElementById("hamburgerBtn");
    const nav = document.getElementById("mobileResponsive");
    const overlay = document.getElementById("navOverlay");
    const isMobile = window.matchMedia("(max-width: 480px)");

    // Adjust main content padding to header height for mobile layouts
    function adjustPadding() {
        if (isMobile.matches) {
            const height = header.offsetHeight;
            content.style.paddingTop = height - 2 + "px";
        } else {
            content.style.paddingTop = "0px";
        }
    }

    window.addEventListener("resize", adjustPadding);
    window.addEventListener("load", adjustPadding);

    /* MOBILE NAV MENU TOGGLE */

    function closeMenu() {
        btn.classList.remove("active");
        nav.classList.remove("open");
        overlay.classList.remove("open");
        document.body.classList.remove("nav-menu-open");
    }

    btn.addEventListener("click", () => {
        const isOpening = !nav.classList.contains("open");

        btn.classList.toggle("active", isOpening);
        nav.classList.toggle("open", isOpening);
        overlay.classList.toggle("open", isOpening);
        document.body.classList.toggle("nav-menu-open", isOpening);
    });

    // Close menu when overlay is clicked
    overlay.addEventListener("click", closeMenu);


    /* HEADER SHRINK ON SCROLL */
    const maxScroll = 180;
    let ticking = false;

    function onScroll() {
        const sc = Math.max(0, window.scrollY);
        const shrink = Math.min(1, sc / maxScroll);

        header.style.setProperty("--shrink", shrink);

        if (sc > 8) header.classList.add("header--pinned");
        else header.classList.remove("header--pinned");

        ticking = false;
    }

    function requestTick() {
        if (!ticking) {
            window.requestAnimationFrame(onScroll);
            ticking = true;
        }
    }

    window.addEventListener("scroll", requestTick, { passive: true });

    // Initialize header state on load
    onScroll();
});
