function mediaLibrary() {
  return {
    items: [],
    isLoading: false,
    errorMessage: '',
    isDragging: false,

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

    async initApp() {
      // Attempt automatic loading of library.json from root or current directory
      this.isLoading = true;
      try {
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

    loadData(data) {
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
