/**
 * LearnHub - Main JavaScript File
 * Handles: Navigation, XML loading, Course filtering,
 *          Form validation, Dynamic lesson display
 * Author: LearnHub Platform
 * Version: 1.0
 */

"use strict";

/* ============================================================
   1. UTILITY HELPERS
   ============================================================ */

/**
 * Selects a single DOM element. Shorthand for querySelector.
 * @param {string} selector - CSS selector string
 * @param {Element} [parent=document] - Optional parent element
 * @returns {Element|null}
 */
function qs(selector, parent = document) {
    return parent.querySelector(selector);
}

/**
 * Selects all matching DOM elements. Shorthand for querySelectorAll.
 * @param {string} selector - CSS selector string
 * @param {Element} [parent=document] - Optional parent element
 * @returns {NodeList}
 */
function qsa(selector, parent = document) {
    return parent.querySelectorAll(selector);
}

/**
 * Marks a form field as having an error state.
 * @param {Element} input - The input element
 * @param {string} message - The error message to display
 */
function showError(input, message) {
    const group = input.closest('.form-group');
    if (!group) return;
    const errorEl = group.querySelector('.form-error');
    input.classList.add('is-error');
    input.classList.remove('is-valid');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.add('visible');
    }
}

/**
 * Marks a form field as valid and clears any error state.
 * @param {Element} input - The input element
 */
function showValid(input) {
    const group = input.closest('.form-group');
    if (!group) return;
    const errorEl = group.querySelector('.form-error');
    input.classList.remove('is-error');
    input.classList.add('is-valid');
    if (errorEl) {
        errorEl.textContent = '';
        errorEl.classList.remove('visible');
    }
}

/**
 * Clears all validation states from a form field.
 * @param {Element} input - The input element
 */
function clearValidation(input) {
    const group = input.closest('.form-group');
    if (!group) return;
    const errorEl = group.querySelector('.form-error');
    input.classList.remove('is-error', 'is-valid');
    if (errorEl) {
        errorEl.textContent = '';
        errorEl.classList.remove('visible');
    }
}

/* ============================================================
   2. NAVIGATION - Mobile Hamburger Menu
   ============================================================ */

/**
 * Initialises the mobile hamburger menu toggle.
 * Sets aria-expanded and toggles the .open class on the nav.
 */
function initNavigation() {
    const hamburger = qs('.navbar__hamburger');
    const nav       = qs('.navbar__nav');

    if (!hamburger || !nav) return;

    hamburger.addEventListener('click', function () {
        const isOpen = nav.classList.toggle('open');
        hamburger.setAttribute('aria-expanded', isOpen);
    });

    // Close menu when a nav link is clicked
    qsa('.navbar__nav a').forEach(function (link) {
        link.addEventListener('click', function () {
            nav.classList.remove('open');
            hamburger.setAttribute('aria-expanded', 'false');
        });
    });

    // Close menu if user clicks outside the navbar
    document.addEventListener('click', function (e) {
        if (!e.target.closest('.navbar')) {
            nav.classList.remove('open');
            hamburger.setAttribute('aria-expanded', 'false');
        }
    });

    // Highlight the active nav link based on current page
    const currentPage = window.location.pathname.split('/').pop();
    qsa('.navbar__nav a').forEach(function (link) {
        const href = link.getAttribute('href');
        if (href === currentPage || (currentPage === '' && href === 'index.html')) {
            link.classList.add('active');
        }
    });
}

/* ============================================================
   3. XML LOADING & PARSING - Load courses.xml
   ============================================================ */

/**
 * Loads and parses the courses.xml file using XMLHttpRequest.
 * Returns a Promise that resolves with the XMLDocument.
 * @returns {Promise<XMLDocument>}
 */
function loadCoursesXML() {
    return new Promise(function (resolve, reject) {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'courses.xml', true);
        xhr.responseType = 'document';
        xhr.overrideMimeType('text/xml');

        xhr.onload = function () {
            if (xhr.status === 200) {
                resolve(xhr.responseXML);
            } else {
                reject(new Error('Failed to load courses.xml: ' + xhr.status));
            }
        };

        xhr.onerror = function () {
            reject(new Error('Network error when loading courses.xml'));
        };

        xhr.send();
    });
}

/**
 * Parses a single <course> XML element into a plain JS object.
 * @param {Element} courseEl - A <course> XML element
 * @returns {Object} Course data object
 */
function parseCourseElement(courseEl) {
    // Helper to get text content of a child element
    function getText(tag) {
        const el = courseEl.querySelector(tag);
        return el ? el.textContent.trim() : '';
    }

    // Parse all <lesson> elements inside <lessons>
    const lessonEls = courseEl.querySelectorAll('lessons lesson');
    const lessons = Array.from(lessonEls).map(function (l) {
        return {
            number: l.getAttribute('number'),
            title: l.textContent.trim()
        };
    });

    // Parse all <objective> elements
    const objEls = courseEl.querySelectorAll('objectives objective');
    const objectives = Array.from(objEls).map(function (o) {
        return o.textContent.trim();
    });

    return {
        id:           courseEl.getAttribute('id'),
        category:     courseEl.getAttribute('category'),
        level:        courseEl.getAttribute('level'),
        title:        getText('title'),
        code:         getText('code'),
        description:  getText('description'),
        duration:     getText('duration'),
        instructor:   getText('instructor'),
        certificate:  getText('certificate'),
        totalLessons: getText('totalLessons'),
        lessons:      lessons,
        objectives:   objectives
    };
}

/* ============================================================
   4. FEATURED COURSES - Homepage
   ============================================================ */

/**
 * Renders three featured course cards on the homepage.
 * Reads from XML and injects HTML into #featured-courses-grid.
 */
function initFeaturedCourses() {
    const grid = qs('#featured-courses-grid');
    if (!grid) return;

    loadCoursesXML()
        .then(function (xml) {
            const courseEls = xml.querySelectorAll('course');
            // Show the first 3 courses as featured
            const featured = Array.from(courseEls).slice(0, 3);

            grid.innerHTML = '';

            featured.forEach(function (courseEl) {
                const c = parseCourseElement(courseEl);
                const card = buildCourseCard(c, true);
                grid.appendChild(card);
            });
        })
        .catch(function (err) {
            console.error('Could not load featured courses:', err);
            grid.innerHTML = '<p class="text-muted text-center" style="padding:40px">Unable to load courses at this time.</p>';
        });
}

/* ============================================================
   5. ALL COURSES PAGE - Filtering & Display
   ============================================================ */

/** Stores all parsed course objects for filtering */
let allCourses = [];

/**
 * Initialises the All Courses page.
 * Loads XML, renders cards, sets up search and filter controls.
 */
let currentPage = 1;
const COURSES_PER_PAGE = 6;

function initAllCoursesPage() {
    const grid = qs('#all-courses-grid');
    if (!grid) return;

    const searchInput = qs('#course-search');
    const levelFilter = qs('#level-filter');
    const catFilter   = qs('#category-filter');

    loadCoursesXML()
        .then(function (xml) {
            const courseEls = xml.querySelectorAll('course');
            allCourses = Array.from(courseEls).map(parseCourseElement);
            renderPage(grid, searchInput, levelFilter, catFilter);

            if (searchInput) {
                searchInput.addEventListener('input', function () {
                    currentPage = 1;
                    renderPage(grid, searchInput, levelFilter, catFilter);
                });
            }
            if (levelFilter) {
                levelFilter.addEventListener('change', function () {
                    currentPage = 1;
                    renderPage(grid, searchInput, levelFilter, catFilter);
                });
            }
            if (catFilter) {
                catFilter.addEventListener('change', function () {
                    currentPage = 1;
                    renderPage(grid, searchInput, levelFilter, catFilter);
                });
            }
        })
        .catch(function (err) {
            console.error('Could not load courses:', err);
            grid.innerHTML = '<p class="text-muted text-center" style="padding:60px">Unable to load courses.</p>';
        });
}

function getFilteredCourses(searchInput, levelFilter, catFilter) {
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const levelVal   = levelFilter ? levelFilter.value : 'all';
    const catVal     = catFilter   ? catFilter.value   : 'all';

    return allCourses.filter(function (course) {
        const matchesSearch = !searchTerm
            || course.title.toLowerCase().includes(searchTerm)
            || course.description.toLowerCase().includes(searchTerm)
            || course.instructor.toLowerCase().includes(searchTerm)
            || course.code.toLowerCase().includes(searchTerm);
        const matchesLevel    = levelVal === 'all' || course.level.toLowerCase() === levelVal.toLowerCase();
        const matchesCategory = catVal === 'all'   || course.category.toLowerCase() === catVal.toLowerCase();
        return matchesSearch && matchesLevel && matchesCategory;
    });
}

function renderPage(grid, searchInput, levelFilter, catFilter) {
    const filtered   = getFilteredCourses(searchInput, levelFilter, catFilter);
    const totalPages = Math.ceil(filtered.length / COURSES_PER_PAGE);
    const start      = (currentPage - 1) * COURSES_PER_PAGE;
    const pageItems  = filtered.slice(start, start + COURSES_PER_PAGE);

    renderCourseGrid(pageItems, grid);
    renderPagination(totalPages);
}

function renderPagination(totalPages) {
    const nav = qs('.pagination');
    if (!nav) return;

    nav.innerHTML = '';

    // Previous button
    const prev = document.createElement('button');
    prev.className = 'pagination__btn';
    prev.textContent = '‹';
    prev.setAttribute('aria-label', 'Previous page');
    prev.disabled = currentPage === 1;
    prev.addEventListener('click', function () {
        if (currentPage > 1) { currentPage--; scrollToGrid(); renderPage(qs('#all-courses-grid'), qs('#course-search'), qs('#level-filter'), qs('#category-filter')); }
    });
    nav.appendChild(prev);

    // Page number buttons
    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.className = 'pagination__btn' + (i === currentPage ? ' active' : '');
        btn.textContent = i;
        btn.setAttribute('aria-label', 'Page ' + i);
        if (i === currentPage) btn.setAttribute('aria-current', 'page');
        btn.addEventListener('click', function () {
            currentPage = i;
            scrollToGrid();
            renderPage(qs('#all-courses-grid'), qs('#course-search'), qs('#level-filter'), qs('#category-filter'));
        });
        nav.appendChild(btn);
    }

    // Next button
    const next = document.createElement('button');
    next.className = 'pagination__btn';
    next.textContent = '›';
    next.setAttribute('aria-label', 'Next page');
    next.disabled = currentPage === totalPages || totalPages === 0;
    next.addEventListener('click', function () {
        if (currentPage < totalPages) { currentPage++; scrollToGrid(); renderPage(qs('#all-courses-grid'), qs('#course-search'), qs('#level-filter'), qs('#category-filter')); }
    });
    nav.appendChild(next);
}

function scrollToGrid() {
    const grid = qs('#all-courses-grid');
    if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Filters allCourses based on search text, level, and category.
 * Re-renders the visible cards each time filters change.
 * Supports more than TWO filter options for level and category.
 * @param {Element} grid - The grid container element
 * @param {Element} searchInput - The search text input
 * @param {Element} levelFilter - The level <select> element
 * @param {Element} catFilter - The category <select> element
 */
function applyFilters(grid, searchInput, levelFilter, catFilter) {
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const levelVal   = levelFilter ? levelFilter.value : 'all';
    const catVal     = catFilter   ? catFilter.value   : 'all';

    // Filter logic covers Foundation, Undergraduate, Postgraduate (3+ options)
    const filtered = allCourses.filter(function (course) {
        // Match search term against title, description, or instructor
        const matchesSearch = !searchTerm
            || course.title.toLowerCase().includes(searchTerm)
            || course.description.toLowerCase().includes(searchTerm)
            || course.instructor.toLowerCase().includes(searchTerm)
            || course.code.toLowerCase().includes(searchTerm);

        // Match level filter (Foundation / Undergraduate / Postgraduate / all)
        const matchesLevel = levelVal === 'all'
            || course.level.toLowerCase() === levelVal.toLowerCase();

        // Match category filter (Technology / Design / Business / all)
        const matchesCategory = catVal === 'all'
            || course.category.toLowerCase() === catVal.toLowerCase();

        return matchesSearch && matchesLevel && matchesCategory;
    });

    renderCourseGrid(filtered, grid);
}

/**
 * Renders an array of course objects into the grid container.
 * Shows a "no results" state if the array is empty.
 * @param {Object[]} courses - Array of course objects
 * @param {Element} grid - The container element
 */
function renderCourseGrid(courses, grid) {
    grid.innerHTML = '';

    if (courses.length === 0) {
        grid.innerHTML = `
            <div class="no-results" style="grid-column:1/-1">
                <div class="no-results__icon">🔍</div>
                <div class="no-results__title">No courses match your search</div>
                <p>Try different keywords or clear your filters.</p>
            </div>`;
        return;
    }

    courses.forEach(function (course) {
        const card = buildCourseCard(course, false);
        grid.appendChild(card);
    });
}

/**
 * Builds and returns a course card DOM element.
 * @param {Object} course - Course data object
 * @param {boolean} featured - Whether to show a "Featured" badge
 * @returns {HTMLElement}
 */
function buildCourseCard(course, featured) {
    const card = document.createElement('article');
    card.className = 'course-card';
    card.setAttribute('aria-label', 'Course: ' + course.title);

    const badgeHTML = featured
        ? '<span class="course-card__badge">Featured</span>'
        : '';

    card.innerHTML = `
        <div class="course-card__image">
            <div class="course-card__image-placeholder" aria-hidden="true">Course Image</div>
            ${badgeHTML}
        </div>
        <div class="course-card__body">
            <div class="course-card__category">${escapeHTML(course.category)} &bull; ${escapeHTML(course.level)}</div>
            <h3 class="course-card__title">${escapeHTML(course.title)}</h3>
            <p class="course-card__desc">${escapeHTML(course.description.substring(0, 100))}...</p>
            <div class="course-card__meta">
                <div class="course-card__meta-item">
                    <span class="meta-icon" aria-hidden="true">⏱</span>
                    ${escapeHTML(course.duration)}
                </div>
                <div class="course-card__meta-item">
                    <span class="meta-icon" aria-hidden="true">👤</span>
                    ${escapeHTML(course.instructor.split(' ').pop())}
                </div>
                <div class="course-card__meta-item">
                    <span class="meta-icon" aria-hidden="true">📚</span>
                    ${escapeHTML(course.totalLessons)} Lessons
                </div>
            </div>
            <a href="course-details.html?id=${encodeURIComponent(course.id)}"
               class="btn btn--dark btn--full"
               aria-label="View details for ${escapeHTML(course.title)}">
               View Details
            </a>
        </div>`;

    return card;
}

/**
 * Escapes HTML special characters to prevent XSS.
 * @param {string} str - Input string
 * @returns {string} Escaped string
 */
function escapeHTML(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/* ============================================================
   6. COURSE DETAILS PAGE - Dynamic XML Rendering
   ============================================================ */

/**
 * Initialises the Course Details page.
 * Reads course ID from URL params, loads XML, and renders detail view.
 */
function initCourseDetailsPage() {
    const titleEl = qs('#course-detail-title');
    if (!titleEl) return;

    // Read the course ID from the URL query string
    const params   = new URLSearchParams(window.location.search);
    const courseId = params.get('id') || 'C001';

    loadCoursesXML()
        .then(function (xml) {
            const courseEls = Array.from(xml.querySelectorAll('course'));
            const found     = courseEls.find(function (el) {
                return el.getAttribute('id') === courseId;
            });

            if (!found) {
                titleEl.textContent = 'Course not found.';
                return;
            }

            const course  = parseCourseElement(found);
            const related = courseEls
                .filter(function (el) {
                    return el.getAttribute('id') !== courseId &&
                           el.getAttribute('category') === course.category;
                })
                .slice(0, 2)
                .map(parseCourseElement);

            renderCourseDetail(course, related);
        })
        .catch(function (err) {
            console.error('Could not load course details:', err);
            if (titleEl) titleEl.textContent = 'Error loading course.';
        });
}

/**
 * Populates all course-detail elements on the page with course data.
 * @param {Object} course - Course data object
 * @param {Object[]} related - Array of related course objects (max 2)
 */
function renderCourseDetail(course, related) {
    // Title
    const titleEl = qs('#course-detail-title');
    if (titleEl) titleEl.textContent = course.title;

    // Update page title
    document.title = course.title + ' | LearnHub';

    // Breadcrumb
    const bcEl = qs('#breadcrumb-course-title');
    if (bcEl) bcEl.textContent = course.title;

    // Summary sidebar
    setTextContent('#detail-duration',     course.duration);
    setTextContent('#detail-level',        course.level);
    setTextContent('#detail-lessons',      course.totalLessons + ' Units');
    setTextContent('#detail-certificate',  course.certificate);
    setTextContent('#detail-code',         course.code);

    // Description
    const descEl = qs('#course-description');
    if (descEl) descEl.textContent = course.description;

    // Objectives
    const objGrid = qs('#objectives-grid');
    if (objGrid) {
        objGrid.innerHTML = '';
        course.objectives.forEach(function (obj) {
            const div = document.createElement('div');
            div.className = 'objective-item';
            div.textContent = obj;
            objGrid.appendChild(div);
        });
    }

    // Lessons
    const lessonsList = qs('#lessons-list');
    const lessonsCountEl = qs('#lessons-total');
    if (lessonsCountEl) lessonsCountEl.textContent = 'Total: ' + course.totalLessons + ' Lessons';

    if (lessonsList) {
        lessonsList.innerHTML = '';
        course.lessons.forEach(function (lesson) {
            const li = document.createElement('div');
            li.className = 'lesson-item';
            li.innerHTML = `
                <span class="lesson-item__num">${escapeHTML(lesson.number)}</span>
                <span class="lesson-item__title">${escapeHTML(lesson.title)}</span>
                <span class="lesson-item__icon" aria-hidden="true">▶</span>`;
            lessonsList.appendChild(li);
        });
    }

    // Instructor
    setTextContent('#instructor-name',    course.instructor);
    setTextContent('#instructor-initials', getInitials(course.instructor));

    // Related courses
    const relatedContainer = qs('#related-courses');
    if (relatedContainer) {
        relatedContainer.innerHTML = '';
        if (related.length === 0) {
            relatedContainer.innerHTML = '<p class="text-muted" style="font-size:0.82rem">No related courses found.</p>';
        } else {
            related.forEach(function (rc) {
                const a = document.createElement('a');
                a.href = 'course-details.html?id=' + encodeURIComponent(rc.id);
                a.className = 'related-card';
                a.setAttribute('aria-label', 'View related course: ' + rc.title);
                a.innerHTML = `
                    <div class="related-card__thumb" aria-hidden="true"></div>
                    <div>
                        <div class="related-card__title">${escapeHTML(rc.title)}</div>
                        <div class="related-card__meta">${escapeHTML(rc.duration)}</div>
                    </div>`;
                relatedContainer.appendChild(a);
            });
        }
    }

    // Populate course select on registration page (if linking)
    populateCourseSelectFromDetail(course.title);
}

/**
 * Helper: sets textContent of a selected element.
 * @param {string} selector - CSS selector
 * @param {string} text - Text to set
 */
function setTextContent(selector, text) {
    const el = qs(selector);
    if (el) el.textContent = text;
}

/**
 * Returns the initials of a name string.
 * E.g. "Dr. Sarah Mitchell" → "SM"
 * @param {string} name - Full name string
 * @returns {string} Initials (max 2 characters)
 */
function getInitials(name) {
    return name.replace(/^(Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.)\s+/i, '')
               .split(' ')
               .filter(Boolean)
               .slice(0, 2)
               .map(function (w) { return w[0].toUpperCase(); })
               .join('');
}

/**
 * If a course-select dropdown exists on the page,
 * sets its value to the current course title.
 * @param {string} courseTitle - Course title string
 */
function populateCourseSelectFromDetail(courseTitle) {
    // Only relevant if registration form is on same page (future-proofing)
    const sel = qs('#select-course');
    if (!sel) return;
    const options = Array.from(sel.options);
    const match = options.find(function (o) { return o.textContent === courseTitle; });
    if (match) sel.value = match.value;
}

/* ============================================================
   7. REGISTRATION FORM - JavaScript Validation
   (HTML5 built-in validation is NOT used per brief requirement)
   ============================================================ */

/**
 * Initialises the student registration form with JS validation.
 * Validates: Full Name, Email Address, and Password (3 required fields).
 */
function initRegistrationForm() {
    const form = qs('#registration-form');
    if (!form) return;

    // Load courses into the select dropdown from XML
    loadCourseSelectOptions();

    // Real-time validation on blur for each input
    const fullName        = qs('#full-name');
    const emailAddress    = qs('#email-address');
    const phoneNumber     = qs('#phone-number');
    const courseSelect    = qs('#select-course');
    const password        = qs('#password');
    const confirmPassword = qs('#confirm-password');
    const termsCheck      = qs('#terms-check');

    // Attach blur-based validation to key fields
    if (fullName) {
        fullName.addEventListener('blur', function () {
            validateFullName(fullName);
        });
        fullName.addEventListener('input', function () {
            clearValidation(fullName);
        });
    }

    if (emailAddress) {
        emailAddress.addEventListener('blur', function () {
            validateEmail(emailAddress);
        });
        emailAddress.addEventListener('input', function () {
            clearValidation(emailAddress);
        });
    }

    if (password) {
        password.addEventListener('blur', function () {
            validatePassword(password);
        });
        password.addEventListener('input', function () {
            clearValidation(password);
        });
    }

    if (confirmPassword) {
        confirmPassword.addEventListener('blur', function () {
            validateConfirmPassword(password, confirmPassword);
        });
        confirmPassword.addEventListener('input', function () {
            clearValidation(confirmPassword);
        });
    }

    // Form submit handler - run full validation before allowing submit
    form.addEventListener('submit', function (e) {
        e.preventDefault(); // Always prevent default (no HTML5 validation used)

        let isValid = true;

        // ---- Validate Full Name (Required Field 1) ----
        if (!validateFullName(fullName)) isValid = false;

        // ---- Validate Email (Required Field 2) ----
        if (!validateEmail(emailAddress)) isValid = false;

        // ---- Validate Password (Required Field 3) ----
        if (!validatePassword(password)) isValid = false;

        // ---- Validate Confirm Password ----
        if (!validateConfirmPassword(password, confirmPassword)) isValid = false;

        // ---- Validate Course Selection ----
        if (courseSelect && courseSelect.value === '') {
            showError(courseSelect, 'Please select a course to enrol in.');
            isValid = false;
        } else if (courseSelect) {
            showValid(courseSelect);
        }

        // ---- Validate Terms Checkbox ----
        if (termsCheck && !termsCheck.checked) {
            const termsGroup = termsCheck.closest('.form-group');
            const termsError = termsGroup ? termsGroup.querySelector('.form-error') : null;
            if (termsError) {
                termsError.textContent = 'You must agree to the Terms and Conditions.';
                termsError.classList.add('visible');
            }
            isValid = false;
        } else if (termsCheck) {
            const termsGroup = termsCheck.closest('.form-group');
            const termsError = termsGroup ? termsGroup.querySelector('.form-error') : null;
            if (termsError) {
                termsError.textContent = '';
                termsError.classList.remove('visible');
            }
        }

        // If all validations pass, show success message
        if (isValid) {
            showRegistrationSuccess(form);
        }
    });
}

/**
 * Validates the Full Name field.
 * Rules: Required, at least 2 words, letters and spaces only, min 3 chars.
 * @param {Element} input - The name input element
 * @returns {boolean} true if valid
 */
function validateFullName(input) {
    if (!input) return false;
    const value = input.value.trim();

    if (value === '') {
        showError(input, 'Full name is required.');
        return false;
    }
    if (value.length < 3) {
        showError(input, 'Name must be at least 3 characters long.');
        return false;
    }
    if (!/^[a-zA-Z\s'-]+$/.test(value)) {
        showError(input, 'Name must contain letters only.');
        return false;
    }
    if (value.split(/\s+/).filter(Boolean).length < 2) {
        showError(input, 'Please enter your first and last name.');
        return false;
    }

    showValid(input);
    return true;
}

/**
 * Validates the Email Address field.
 * Rules: Required, must match standard email pattern.
 * @param {Element} input - The email input element
 * @returns {boolean} true if valid
 */
function validateEmail(input) {
    if (!input) return false;
    const value = input.value.trim();

    if (value === '') {
        showError(input, 'Email address is required.');
        return false;
    }

    // Standard email regex pattern (JS-based, not HTML5)
    const emailPattern = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
    if (!emailPattern.test(value)) {
        showError(input, 'Please enter a valid email address (e.g. name@example.com).');
        return false;
    }

    showValid(input);
    return true;
}

/**
 * Validates the Password field.
 * Rules: Required, min 8 chars, at least 1 uppercase, 1 lowercase, 1 digit.
 * @param {Element} input - The password input element
 * @returns {boolean} true if valid
 */
function validatePassword(input) {
    if (!input) return false;
    const value = input.value;

    if (value === '') {
        showError(input, 'Password is required.');
        return false;
    }
    if (value.length < 8) {
        showError(input, 'Password must be at least 8 characters long.');
        return false;
    }
    if (!/[A-Z]/.test(value)) {
        showError(input, 'Password must contain at least one uppercase letter.');
        return false;
    }
    if (!/[a-z]/.test(value)) {
        showError(input, 'Password must contain at least one lowercase letter.');
        return false;
    }
    if (!/[0-9]/.test(value)) {
        showError(input, 'Password must contain at least one number.');
        return false;
    }

    showValid(input);
    return true;
}

/**
 * Validates the Confirm Password field.
 * Rules: Required, must match the password field.
 * @param {Element} passwordInput - The original password input
 * @param {Element} confirmInput - The confirm password input
 * @returns {boolean} true if valid
 */
function validateConfirmPassword(passwordInput, confirmInput) {
    if (!confirmInput || !passwordInput) return false;
    const value = confirmInput.value;

    if (value === '') {
        showError(confirmInput, 'Please confirm your password.');
        return false;
    }
    if (value !== passwordInput.value) {
        showError(confirmInput, 'Passwords do not match. Please re-enter.');
        return false;
    }

    showValid(confirmInput);
    return true;
}

/**
 * Loads course titles from courses.xml and populates the #select-course dropdown.
 */
function loadCourseSelectOptions() {
    const select = qs('#select-course');
    if (!select) return;

    loadCoursesXML()
        .then(function (xml) {
            const courseEls = xml.querySelectorAll('course');
            courseEls.forEach(function (el) {
                const title = el.querySelector('title');
                const id    = el.getAttribute('id');
                if (title) {
                    const option = document.createElement('option');
                    option.value = id;
                    option.textContent = title.textContent.trim();
                    select.appendChild(option);
                }
            });
        })
        .catch(function (err) {
            console.warn('Could not load course list for select:', err);
        });
}

/**
 * Resets the form and displays a success confirmation message.
 * @param {Element} form - The registration form element
 */
function showRegistrationSuccess(form) {
    // Show success message element
    const successMsg = qs('#form-success-msg');
    if (successMsg) {
        successMsg.textContent = '🎉 Registration successful! Welcome to LearnHub. Check your inbox for a confirmation email.';
        successMsg.classList.add('visible');
        successMsg.focus();
        // Scroll into view
        successMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Disable the submit button to prevent re-submission
    const submitBtn = qs('#register-btn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '✓ Registered Successfully';
        submitBtn.style.opacity = '0.7';
    }

    // Reset form values after short delay
    setTimeout(function () {
        form.reset();
        // Clear all validation states
        qsa('.form-input, .form-select, .form-textarea', form).forEach(clearValidation);
    }, 500);
}

/* ============================================================
   8. PAGE ROUTER - Initialise the right functions per page
   ============================================================ */

/**
 * Detects the current page and calls the appropriate init functions.
 * Called once the DOM is fully loaded.
 */
function initPage() {
    const page = window.location.pathname.split('/').pop() || 'index.html';

    // Navigation is global - runs on all pages
    initNavigation();

    // Page-specific initialisers
    if (page === 'index.html' || page === '') {
        initFeaturedCourses();
    }

    if (page === 'courses.html') {
        initAllCoursesPage();
    }

    if (page === 'course-details.html') {
        initCourseDetailsPage();
    }

    if (page === 'register.html') {
        initRegistrationForm();
    }
}

/* ============================================================
   9. DOM READY - Entry Point
   ============================================================ */

document.addEventListener('DOMContentLoaded', initPage);
