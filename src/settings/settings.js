/**
 * Tessera — Settings Window Logic
 * Handles data binding, shortcut recording, profiles, import/export.
 */

let allSettings = {};
let saveTimeout = null;

// ─── Init ───────────────────────────────────────────────────────────────────

(async () => {
  allSettings = await window.tesseraSettings.getAll();
  populateFields();
  wireNavigation();
  wireInputs();
  wireShortcutRecording();
  wireProfiles();
  wireFooterButtons();
})();

// ─── Navigation ─────────────────────────────────────────────────────────────

function wireNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(btn => {
    btn.addEventListener('click', () => {
      navItems.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      document.getElementById(`sec-${btn.dataset.section}`).classList.add('active');
    });
  });
}

// ─── Populate fields from settings ──────────────────────────────────────────

function populateFields() {
  document.querySelectorAll('[data-key]').forEach(el => {
    const key = el.dataset.key;
    let value = getNestedValue(allSettings, key);

    if (el.type === 'checkbox') {
      el.checked = !!value;
    } else if (el.tagName === 'TEXTAREA') {
      if (Array.isArray(value)) {
        el.value = value.join('\n');
      } else {
        el.value = value || '';
      }
    } else if (el.tagName === 'SELECT') {
      el.value = value || '';
    } else {
      el.value = value || '';
    }
  });
}

// ─── Wire inputs for auto-save ──────────────────────────────────────────────

function wireInputs() {
  document.querySelectorAll('[data-key]').forEach(el => {
    const key = el.dataset.key;
    const eventType = (el.type === 'checkbox') ? 'change' :
                      (el.tagName === 'SELECT' || el.type === 'color') ? 'change' : 'input';

    el.addEventListener(eventType, () => {
      let value;
      if (el.type === 'checkbox') {
        value = el.checked;
      } else if (el.type === 'number') {
        value = parseInt(el.value, 10) || 0;
      } else if (el.tagName === 'TEXTAREA') {
        // Check if this is an array field (domains, keywords)
        if (key.endsWith('Domains') || key === 'auth.authPathKeywords') {
          if (key === 'auth.authPathKeywords') {
            value = el.value.split(',').map(s => s.trim()).filter(Boolean);
          } else {
            value = el.value.split('\n').map(s => s.trim()).filter(Boolean);
          }
        } else {
          value = el.value;
        }
      } else {
        value = el.value;
      }

      // Debounce save
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        window.tesseraSettings.set(key, value);
        setNestedValue(allSettings, key, value);
      }, 300);
    });
  });
}

// ─── Shortcut recording ─────────────────────────────────────────────────────

function wireShortcutRecording() {
  document.querySelectorAll('.shortcut-input').forEach(input => {
    input.addEventListener('focus', () => {
      input.value = 'Press keys…';
      input.style.color = 'var(--accent)';
    });

    input.addEventListener('blur', () => {
      // Restore original value if nothing was recorded
      const key = input.dataset.key;
      const current = getNestedValue(allSettings, key);
      if (input.value === 'Press keys…') {
        input.value = current || '';
      }
      input.style.color = '';
    });

    input.addEventListener('keydown', (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape') {
        input.blur();
        return;
      }

      // Build accelerator string
      const parts = [];
      if (e.ctrlKey) parts.push('Ctrl');
      if (e.altKey) parts.push('Alt');
      if (e.shiftKey) parts.push('Shift');
      if (e.metaKey) parts.push('CmdOrCtrl');

      // Don't record modifier-only presses
      const modKeys = ['Control', 'Alt', 'Shift', 'Meta'];
      if (modKeys.includes(e.key)) return;

      // Map special keys
      let key = e.key;
      if (key === ' ') key = 'Space';
      else if (key.length === 1) key = key.toUpperCase();
      else if (key === 'ArrowUp') key = 'Up';
      else if (key === 'ArrowDown') key = 'Down';
      else if (key === 'ArrowLeft') key = 'Left';
      else if (key === 'ArrowRight') key = 'Right';
      else if (key === 'Backspace') key = 'Backspace';
      else if (key === 'Delete') key = 'Delete';
      else if (key === 'Enter') key = 'Return';
      else if (key === 'Tab') key = 'Tab';

      parts.push(key);
      const accelerator = parts.join('+');

      input.value = accelerator;
      input.style.color = '';

      // Save
      const settingsKey = input.dataset.key;
      window.tesseraSettings.set(settingsKey, accelerator);
      setNestedValue(allSettings, settingsKey, accelerator);

      input.blur();
    });
  });
}

// ─── Profiles ───────────────────────────────────────────────────────────────

function wireProfiles() {
  const select = document.getElementById('profiles-active');
  const nameInput = document.getElementById('profile-name');
  const urlInput = document.getElementById('profile-defaultUrl');
  const partitionInput = document.getElementById('profile-cookiePartition');
  const domainsInput = document.getElementById('profile-inAppDomains');
  const cssInput = document.getElementById('profile-customCSS');
  const jsInput = document.getElementById('profile-customJS');

  function refreshProfileList() {
    const profiles = allSettings.profiles?.list || [];
    select.innerHTML = '';
    profiles.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      select.appendChild(opt);
    });
    select.value = allSettings.profiles?.active || 'default';
    loadActiveProfile();
  }

  function loadActiveProfile() {
    const profiles = allSettings.profiles?.list || [];
    const active = profiles.find(p => p.id === select.value);
    if (!active) return;
    nameInput.value = active.name || '';
    urlInput.value = active.defaultUrl || '';
    partitionInput.value = active.cookiePartition || '';
    domainsInput.value = (active.inAppDomains || []).join('\n');
    cssInput.value = active.customCSS || '';
    jsInput.value = active.customJS || '';
  }

  select.addEventListener('change', () => {
    window.tesseraSettings.set('profiles.active', select.value);
    allSettings.profiles.active = select.value;
    loadActiveProfile();
  });

  document.getElementById('btn-save-profile').addEventListener('click', () => {
    const profiles = allSettings.profiles?.list || [];
    const idx = profiles.findIndex(p => p.id === select.value);
    if (idx === -1) return;
    profiles[idx].name = nameInput.value;
    profiles[idx].defaultUrl = urlInput.value;
    profiles[idx].cookiePartition = partitionInput.value;
    profiles[idx].inAppDomains = domainsInput.value.split('\n').map(s => s.trim()).filter(Boolean);
    profiles[idx].customCSS = cssInput.value;
    profiles[idx].customJS = jsInput.value;
    window.tesseraSettings.set('profiles.list', profiles);
    allSettings.profiles.list = profiles;
    refreshProfileList();
  });

  document.getElementById('btn-add-profile').addEventListener('click', () => {
    const profiles = allSettings.profiles?.list || [];
    const id = 'profile-' + Date.now();
    profiles.push({
      id,
      name: 'New Profile',
      defaultUrl: '',
      cookiePartition: `persist:${id}`,
      inAppDomains: [],
      customCSS: '',
      customJS: ''
    });
    window.tesseraSettings.set('profiles.list', profiles);
    window.tesseraSettings.set('profiles.active', id);
    allSettings.profiles.list = profiles;
    allSettings.profiles.active = id;
    refreshProfileList();
  });

  document.getElementById('btn-delete-profile').addEventListener('click', () => {
    const profiles = allSettings.profiles?.list || [];
    if (profiles.length <= 1) return; // Can't delete last profile
    const idx = profiles.findIndex(p => p.id === select.value);
    if (idx === -1) return;
    profiles.splice(idx, 1);
    const newActive = profiles[0].id;
    window.tesseraSettings.set('profiles.list', profiles);
    window.tesseraSettings.set('profiles.active', newActive);
    allSettings.profiles.list = profiles;
    allSettings.profiles.active = newActive;
    refreshProfileList();
  });

  refreshProfileList();
}

// ─── Footer buttons ─────────────────────────────────────────────────────────

function wireFooterButtons() {
  document.getElementById('btn-export').addEventListener('click', async () => {
    const json = await window.tesseraSettings.export();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tessera-settings.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('btn-import').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const text = await file.text();
      const result = await window.tesseraSettings.import(text);
      if (result.success) {
        allSettings = await window.tesseraSettings.getAll();
        populateFields();
      } else {
        alert('Import failed: ' + result.error);
      }
    });
    input.click();
  });

  document.getElementById('btn-reset').addEventListener('click', async () => {
    if (confirm('Reset all settings to defaults? This cannot be undone.')) {
      await window.tesseraSettings.reset();
      allSettings = await window.tesseraSettings.getAll();
      populateFields();
    }
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getNestedValue(obj, path) {
  return path.split('.').reduce((o, k) => (o && o[k] !== undefined) ? o[k] : undefined, obj);
}

function setNestedValue(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((o, k) => {
    if (!o[k]) o[k] = {};
    return o[k];
  }, obj);
  target[last] = value;
}
