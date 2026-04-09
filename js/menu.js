document.addEventListener("DOMContentLoaded", () => {
  const data = window.menuData;

  const CATEGORY_ORDER = [
    "Breakfast",
    "Snacks",
    "Salad",
    "Soups",
    "Appetizers",
    "Tandoori Entries",
    "Curries",
    "Biryani",
    "Rice",
    "Breads",
    "Dessert",
    "Drinks",
  ];

  const categories = CATEGORY_ORDER.filter(cat =>
    data.some(item => item.category === cat)
  );

  const categoriesContainer = document.getElementById("menu-categories");
  const itemsContainer = document.getElementById("menu-items");

  // Create a custom dropdown for mobile devices
  const mobileDropdownWrapper = document.createElement('div');
  mobileDropdownWrapper.className = 'category-dropdown-wrapper';
  const mobileToggle = document.createElement('button');
  mobileToggle.className = 'category-dropdown-toggle';
  mobileToggle.setAttribute('aria-haspopup', 'listbox');
  mobileToggle.setAttribute('aria-expanded', 'false');

  mobileToggle.innerHTML = `
    <span class="category-dropdown-label">Categories</span>
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down-icon" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
  `;

  const mobileList = document.createElement('ul');
  mobileList.className = 'category-dropdown-list';
  mobileList.setAttribute('role', 'listbox');

  mobileDropdownWrapper.appendChild(mobileToggle);
  mobileDropdownWrapper.appendChild(mobileList);
  categoriesContainer.parentNode.insertBefore(mobileDropdownWrapper, categoriesContainer);

  // Create category buttons
  categories.forEach(cat => {
    const btn = document.createElement("button");
    btn.className = "category-btn";
    btn.innerText = cat;
    btn.dataset.category = cat;

    btn.addEventListener("click", () => {
      selectCategory(cat, true);
    });

    categoriesContainer.appendChild(btn);

    // Also add list items for mobile custom dropdown
    const li = document.createElement('li');
    li.className = 'category-dropdown-item';
    li.setAttribute('role', 'option');
    li.tabIndex = 0;
    li.innerText = cat;
    li.dataset.category = cat;
    li.setAttribute('aria-selected', 'false');
    li.addEventListener('click', () => {
      selectCategory(cat, true);
      closeDropdown();
    });
    li.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectCategory(cat, true);
        closeDropdown();
      }
    });
    mobileList.appendChild(li);
  });

  // Central selection function to keep desktop buttons, dropdown items,
  // label, and content in sync. Used for initial selection too.
  function selectCategory(category, scrollToTop) {
    // update label
    const labelEl = mobileToggle.querySelector('.category-dropdown-label');
    if (labelEl && labelEl.innerText !== category) labelEl.innerText = category;

    // update desktop buttons
    document.querySelectorAll('.category-btn').forEach(b => {
      if (b.dataset.category === category) b.classList.add('active');
      else b.classList.remove('active');
    });

    // update dropdown items
    mobileList.querySelectorAll('.category-dropdown-item').forEach(li => {
      if (li.dataset.category === category) {
        li.classList.add('active');
        li.setAttribute('aria-selected', 'true');
      } else {
        li.classList.remove('active');
        li.setAttribute('aria-selected', 'false');
      }
    });

    // render items
    displayItems(category, scrollToTop);
  }

  if (categories.length) {
    // select first category without scrolling on initial load
    selectCategory(categories[0], false);
  }

  // Display items for selected category
  function displayItems(category, scrollToTop) {
    itemsContainer.innerHTML = "";

    const filtered = data
      .filter(item => item.category === category)
      .sort((a, b) => a.itemOrder - b.itemOrder);

    filtered.forEach(item => {
      const div = document.createElement("div");
      div.className = "menu-item";

      div.innerHTML = `
        <div class="item-row">
          <span class="item-name">${item.name}</span>
          <span class="dots"></span>
          <span class="item-price">$${item.price}</span>
        </div>

        ${item.description ? `<p class="item-desc">${item.description}</p>` : ""}
      `;

      itemsContainer.appendChild(div);
    });

    // For new category selected through dropdown, scroll the page so the menu
    // content is visible near the top. Compute header offset if present.
    if (scrollToTop) {
      try {
        var menuSection = document.querySelector('.menu');
        var header = document.querySelector('header');
        var offset = header ? header.offsetHeight : 0;
        if (menuSection) {
          var target = menuSection.getBoundingClientRect().top + window.scrollY - offset - 8; // small gap
          window.scrollTo({ top: target, behavior: 'smooth' });
        }
      } catch (e) {
        // ignore
      }
    }
  }

  // Dropdown open/close helpers
  function openDropdown() {
    mobileDropdownWrapper.classList.add('open');
    mobileToggle.setAttribute('aria-expanded', 'true');
  }

  function closeDropdown() {
    mobileDropdownWrapper.classList.remove('open');
    mobileToggle.setAttribute('aria-expanded', 'false');
  }

  // Toggle on button click
  mobileToggle.addEventListener('click', function (e) {
    const isOpen = mobileDropdownWrapper.classList.contains('open');
    if (isOpen) closeDropdown(); else openDropdown();
  });

  // Close when clicking outside
  document.addEventListener('click', function (e) {
    if (!mobileDropdownWrapper.contains(e.target)) closeDropdown();
  });

  // Keyboard: close on Escape
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeDropdown();
  });

  // Make the dropdown wrapper sticky beneath the header so it remains
  // in view while scrolling on mobile. Compute header height and apply.
  (function setStickyOffset() {
    try {
      var header = document.querySelector('header');
      var offset = header ? header.offsetHeight : 0;
      // apply styles only for the wrapper; CSS still controls display
      mobileDropdownWrapper.style.position = 'sticky';
      mobileDropdownWrapper.style.top = offset + 'px';
      mobileDropdownWrapper.style.zIndex = 10;
    } catch (e) {
      // noop
    }
  })();

  // Update offset on scroll (header may change size on scroll)
  window.addEventListener('scroll', function () {
    var header = document.querySelector('header');
    var offset = header ? header.offsetHeight : 0;
    mobileDropdownWrapper.style.top = offset + 'px';
  });
});
