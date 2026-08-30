function mediaLibrary() {
  return {
    items: [],
    isLoading: false,
    isDirty: false,
    errorMessage: '',
    isDragging: false,
    showSettings: false,
    settings: { token: '', gistId: '' },
    settingsError: '',
    settingsSuccess: '',
    syncStatus: 'idle',
    syncVersion: 0,

    // Filter states
    searchQuery: '',
    filterKind: 'all',
    filterSeries: '',
    filterLanguage: '',
    filterLabel: '',

    // Sorting & View
    sortBy: 'title_asc',
    viewMode: 'grid',
    currentPage: 1,
    perPage: 24,

    // Modal state
    selectedItem: null,
    showAddModal: false,
    editingItem: null,
    newItem: blankItem(),

    async initApp() {
      this.isLoading = true;
      try {
        const savedSettings = localStorage.getItem('wan_shi_tong_settings');
        if (savedSettings) this.settings = { ...this.settings, ...JSON.parse(savedSettings) };
        const cachedLibrary = localStorage.getItem('wan_shi_tong_library');
        if (cachedLibrary) {
          const cached = JSON.parse(cachedLibrary);
          this.loadData(cached.items || cached, false);
          this.syncVersion = cached.syncVersion || 0;
        }
        if (this.settings.token && this.settings.gistId) {
          await this.loadFromGist();
          return;
        }
        if (this.items.length) return;
        if (window.location.protocol === 'file:') return;
        const response = await fetch('../library.json').catch(() => fetch('./library.json'));
        if (response && response.ok) {
          const data = await response.json();
          this.loadData(data);
        }
      } catch (e) {
        // Fetch may fail under file:// protocol without webserver, fallback gracefully
        console.info("Automatic library.json load skipped or file protocol active. Please upload manually.");
      } finally {
        this.isLoading = false;
      }
    },

    loadData(data, persist = true) {
      if (Array.isArray(data)) {
        this.items = data;
      } else if (data && Array.isArray(data.items)) {
        this.items = data.items;
      } else if (data && Array.isArray(data.records)) {
        this.items = data.records;
      } else {
        this.errorMessage = "Loaded JSON format unrecognized. Expected an array of records or { items: [...] }.";
        return;
      }
      this.errorMessage = '';
      this.currentPage = 1;
      this.isDirty = false;
      if (persist) this.saveLocal();
    },

    saveLocal() {
      localStorage.setItem('wan_shi_tong_library', JSON.stringify({ version: 1, syncVersion: this.syncVersion, items: this.items }));
    },

    openSettings() {
      this.settingsError = '';
      this.settingsSuccess = '';
      this.showSettings = true;
      this.$nextTick(() => lucide.createIcons());
    },

    async saveSettings() {
      this.settingsError = '';
      this.settingsSuccess = '';
      localStorage.setItem('wan_shi_tong_settings', JSON.stringify(this.settings));
      if (this.settings.token.trim() && this.settings.gistId.trim()) {
        await this.loadFromGist(true);
      } else {
        this.settingsSuccess = this.settings.token.trim() ? 'Token saved. Sync to create a private Gist.' : 'Settings saved.';
      }
    },

    async loadFromGist(showResult = false) {
      try {
        this.syncStatus = 'syncing';
        const data = await GistSync.load(this.settings);
        this.loadData(data.items, false);
        this.syncVersion = data.syncVersion;
        this.saveLocal();
        this.syncStatus = 'synced';
        if (showResult) this.settingsSuccess = 'Connected. Library loaded from Gist.';
      } catch (error) {
        this.syncStatus = 'error';
        if (showResult) this.settingsError = `Could not load Gist: ${error.message}`;
      }
    },

    async syncGist() {
      this.settingsError = '';
      this.settingsSuccess = '';
      try {
        this.syncStatus = 'syncing';
        const data = await GistSync.sync(this.settings, this.items, this.syncVersion);
        this.settings.gistId = data.gistId;
        this.items = data.items;
        this.syncVersion = data.syncVersion;
        localStorage.setItem('wan_shi_tong_settings', JSON.stringify(this.settings));
        this.saveLocal();
        this.isDirty = false;
        this.syncStatus = 'synced';
        this.settingsSuccess = `Synced to Gist ${data.gistId}.`;
      } catch (error) {
        this.syncStatus = 'error';
        this.settingsError = `Could not sync Gist: ${error.message}`;
      }
    },

    handleFileUpload(event) {
      const file = event.target.files[0];
      if (!file) return;
      this.readFile(file);
    },

    handleDrop(event) {
      this.isDragging = false;
      const file = event.dataTransfer.files[0];
      if (file) {
        this.readFile(file);
      }
    },

    readFile(file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target.result);
          this.loadData(json);
        } catch (err) {
          this.errorMessage = "Failed to parse JSON file: " + err.message;
        }
      };
      reader.readAsText(file);
    },

    // Helper getters
    getItemTitle(item) {
      return item.title || item.name || item.original_title || 'Untitled';
    },

    getCreators(item) {
      if (!item.creators) return '';
      if (Array.isArray(item.creators)) return item.creators.join(', ');
      return item.creators;
    },

    getYear(dateStr) {
      if (!dateStr) return '';
      const match = String(dateStr).match(/\d{4}/);
      return match ? match[0] : dateStr;
    },

    getItemKey(item) {
      return item.id || item.imdb_id || item.openlibrary_id || item.isbn || (this.getItemTitle(item) + '_' + (item.release_date || ''));
    },

    get counts() {
      return {
        movie: this.items.filter(i => i.kind === 'movie').length,
        book: this.items.filter(i => i.kind === 'book').length
      };
    },

    get usingGist() {
      return Boolean(this.settings.token.trim() && this.settings.gistId.trim());
    },

    get availableSeries() {
      const set = new Set();
      this.items.forEach(i => {
        if (i.series && typeof i.series === 'string' && i.series.trim()) {
          set.add(i.series.trim());
        }
      });
      return Array.from(set).sort((a, b) => a.localeCompare(b));
    },

    get availableLanguages() {
      const set = new Set();
      this.items.forEach(i => {
        if (i.language && typeof i.language === 'string' && i.language.trim()) {
          set.add(i.language.trim().toLowerCase());
        }
      });
      return Array.from(set).sort((a, b) => a.localeCompare(b));
    },

    get filteredItems() {
      let list = [...this.items];

      // 1. Kind filter
      if (this.filterKind !== 'all') {
        list = list.filter(item => item.kind === this.filterKind);
      }

      // 2. Series filter
      if (this.filterSeries) {
        list = list.filter(item => item.series === this.filterSeries);
      }

      // 3. Language filter
      if (this.filterLanguage) {
        list = list.filter(item => (item.language || '').toLowerCase() === this.filterLanguage.toLowerCase());
      }

      // 4. Label filter
      if (this.filterLabel) {
        list = list.filter(item => Array.isArray(item.labels) && item.labels.includes(this.filterLabel));
      }

      // 5. Search query
      if (this.searchQuery.trim()) {
        const q = this.searchQuery.trim().toLowerCase();
        list = list.filter(item => {
          const title = (item.title || '').toLowerCase();
          const name = (item.name || '').toLowerCase();
          const origTitle = (item.original_title || '').toLowerCase();
          const creators = this.getCreators(item).toLowerCase();
          const desc = (item.description || '').toLowerCase();
          const series = (item.series || '').toLowerCase();
          const imdb = (item.imdb_id || '').toLowerCase();
          const openlib = (item.openlibrary_id || '').toLowerCase();
          const isbn = (item.isbn || '').toLowerCase();
          const labels = Array.isArray(item.labels) ? item.labels.join(' ').toLowerCase() : '';

          return title.includes(q) ||
                 name.includes(q) ||
                 origTitle.includes(q) ||
                 creators.includes(q) ||
                 desc.includes(q) ||
                 series.includes(q) ||
                 imdb.includes(q) ||
                 openlib.includes(q) ||
                 isbn.includes(q) ||
                 labels.includes(q);
        });
      }

      // 6. Sorting
      list.sort((a, b) => {
        const titleA = (this.getItemTitle(a) || '').toLowerCase();
        const titleB = (this.getItemTitle(b) || '').toLowerCase();
        const dateA = a.release_date || '';
        const dateB = b.release_date || '';

        switch (this.sortBy) {
          case 'title_asc':
            return titleA.localeCompare(titleB);
          case 'title_desc':
            return titleB.localeCompare(titleA);
          case 'date_desc':
            return dateB.localeCompare(dateA);
          case 'date_asc':
            return dateA.localeCompare(dateB);
          case 'series_index':
            const idxA = a.series_index != null ? Number(a.series_index) : 999999;
            const idxB = b.series_index != null ? Number(b.series_index) : 999999;
            if (idxA !== idxB) return idxA - idxB;
            return titleA.localeCompare(titleB);
          default:
            return 0;
        }
      });

      return list;
    },

    get totalPages() {
      return Math.ceil(this.filteredItems.length / this.perPage) || 1;
    },

    get paginatedItems() {
      const start = (this.currentPage - 1) * this.perPage;
      return this.filteredItems.slice(start, start + this.perPage);
    },

    resetFilters() {
      this.searchQuery = '';
      this.filterKind = 'all';
      this.filterSeries = '';
      this.filterLanguage = '';
      this.filterLabel = '';
      this.currentPage = 1;
    },

    openAddModal() {
      this.newItem = blankItem();
      this.editingItem = null;
      this.showAddModal = true;
    },

    openEditModal() {
      const item = this.selectedItem;
      if (!item) return;

      this.newItem = itemForm(item);
      this.editingItem = item;
      this.closeModal();
      this.showAddModal = true;
    },

    saveItem() {
      const value = key => this.newItem[key].trim();
      const title = value('title');
      if (!title) {
        this.errorMessage = 'Title is required.';
        return;
      }

      const item = itemFromForm(this.newItem, value, title);
      if (this.editingItem) {
        formItemFields().forEach(field => delete this.editingItem[field]);
        Object.assign(this.editingItem, item);
      } else {
        this.items.push(item);
      }
      this.isDirty = true;
      this.saveLocal();
      this.errorMessage = '';
      this.showAddModal = false;
      this.editingItem = null;
      this.newItem = blankItem();
    },

    downloadLibrary() {
      const blob = new Blob([JSON.stringify(this.items, null, 2) + '\n'], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'library.json';
      link.click();
      URL.revokeObjectURL(url);
      this.isDirty = false;
    },

    openModal(item) {
      this.selectedItem = item;
      document.body.style.overflow = 'hidden';
    },

    closeModal() {
      this.selectedItem = null;
      document.body.style.overflow = '';
    }
  }
}

function blankItem() {
  return {
    kind: 'book',
    title: '',
    original_title: '',
    creators: '',
    release_date: '',
    language: '',
    series: '',
    series_index: '',
    labels: '',
    description: '',
    imdb_id: '',
    openlibrary_id: '',
    isbn: '',
    external_url: '',
    image_path: '',
    image_url: ''
  };
}

function formItemFields() {
  return ['kind', 'title', 'creators', 'original_title', 'release_date', 'language', 'series', 'series_index', 'labels', 'description', 'imdb_id', 'openlibrary_id', 'isbn', 'external_url', 'image_path', 'image_url'];
}

function itemForm(item) {
  return {
    ...blankItem(),
    ...item,
    title: item.title || item.name || item.original_title || '',
    creators: Array.isArray(item.creators) ? item.creators.join(', ') : (item.creators || ''),
    labels: Array.isArray(item.labels) ? item.labels.join(', ') : (item.labels || '')
  };
}

function itemFromForm(item, value, title) {
  const creators = value('creators').split(',').map(creator => creator.trim()).filter(Boolean);
  const labels = value('labels').split(',').map(label => label.trim()).filter(Boolean);
  return {
    kind: item.kind,
    title,
    ...(creators.length && { creators }),
    ...optionalItemFields(item, value),
    ...(labels.length && { labels }),
    ...(item.series_index !== '' && { series_index: Number(item.series_index) })
  };
}

function optionalItemFields(item, value) {
  const fields = ['original_title', 'release_date', 'language', 'series', 'description', 'imdb_id', 'openlibrary_id', 'isbn', 'external_url', 'image_path', 'image_url'];
  return Object.fromEntries(fields.map(field => [field, value(field)]).filter(([, fieldValue]) => fieldValue));
}

document.addEventListener('DOMContentLoaded', () => lucide.createIcons());
