// OpenFang 3D Knowledge Graph Page
'use strict';

function knowledgegraphPage() {
  return {
    graphInstance: null,
    graphData: { nodes: [], links: [] },
    searchTerm: '',
    selectedNode: null,
    loading: true,
    loadError: '',
    showDetails: false,
    nodeDetailData: null,
    // LLM Review state
    reviewRunning: false,
    reviewPercent: 0,
    reviewStatus: '',
    reviewProcessed: 0,
    reviewRemoved: 0,
    reviewResults: [],
    reviewPanelVisible: false,
    _unlistenProgress: null,
    _unlistenComplete: null,
    _unlistenError: null,

    async init() {
      await this.setupReviewListeners();
      await this.loadData();
    },

    async loadData() {
      this.loading = true;
      this.loadError = '';
      let data = null;

      // Try Tauri IPC first
      if (window.__TAURI__ && window.__TAURI__.invoke) {
        try {
          data = await window.__TAURI__.invoke('get_knowledge_graph', { limit: 500 });
        } catch (e) {
          console.warn('[KnowledgeGraph] Tauri invoke failed, trying REST API:', e);
        }
      }

      // Fallback: REST API
      if (!data) {
        try {
          const resp = await fetch('/api/knowledge/graph');
          if (resp.ok) {
            data = await resp.json();
          }
        } catch (e) {
          console.warn('[KnowledgeGraph] REST API failed, using mock data:', e.message);
        }
      }

      if (data && data.nodes && data.nodes.length > 0) {
        this.graphData = data;
      } else if (data && data.nodes) {
        this.graphData = { nodes: [], links: [] };
        this.loadError = '';
      } else {
        this.graphData = { nodes: [], links: [] };
        this.loadError = '';
      }

      this.loading = false;
      if (typeof ForceGraph3D !== 'undefined') {
        this.$nextTick(() => this.initGraph());
      } else {
        this.loadError = '3D graph library not loaded. Check network connection.';
      }
    },

    initGraph() {
      const container = document.getElementById('kg-3d-container');
      if (!container) return;

      container.innerHTML = '';

      try {
        this.graphInstance = ForceGraph3D()(container)
          .graphData(this.graphData)
          .nodeLabel(node => `${node.name}\n${node.type || ''}`)
          .nodeColor(node => this.getNodeColor(node))
          .nodeRelSize(6)
          .nodeVal(node => node.group === 'system' ? 3 : 2)
          .linkWidth(link => link.relationship === 'contains' ? 1.5 : 1)
          .linkOpacity(0.5)
          .linkDirectionalParticles(link => link.relationship === 'contains' ? 2 : 0)
          .linkDirectionalParticleWidth(1.5)
          .backgroundColor('#0a0a2a')
          .onNodeClick(node => {
            this.selectedNode = node;
            this.nodeDetailData = node;
            this.showDetails = true;
            const dist = 100;
            this.graphInstance.cameraPosition(
              { x: node.x + dist * 0.7, y: node.y + dist * 0.5, z: node.z + dist },
              node,
              800
            );
          })
          .onBackgroundClick(() => {
            this.showDetails = false;
            this.selectedNode = null;
          });

        if (this.graphInstance.renderer) {
          this.graphInstance.renderer().setClearColor(0x0a0a2a, 1);
        }
      } catch (e) {
        console.error('[KnowledgeGraph] Init failed:', e);
        this.loadError = 'Failed to initialize 3D graph: ' + e.message;
      }
    },

    getNodeColor(node) {
      const colorMap = {
        'system': '#ff6b6b',
        'agent': '#4ecdc4',
        'feature': '#ffe66d',
        'infra': '#a78bfa',
        'hand': '#a8e6cf',
        'storage': '#ffd93d',
        'automation': '#6bcb77',
        'integration': '#4d96ff',
        'extension': '#ff922b',
      };
      return colorMap[node.group] || '#88ccff';
    },

    resetCamera() {
      if (this.graphInstance) {
        this.graphInstance.cameraPosition(
          { x: 0, y: 0, z: 400 },
          { x: 0, y: 0, z: 0 },
          1000
        );
      }
    },

    searchNode() {
      if (!this.graphInstance || !this.graphData.nodes.length) return;
      const term = this.searchTerm.toLowerCase().trim();
      if (!term) {
        this.graphData.nodes.forEach(n => { n.__visible = true; });
      } else {
        this.graphData.nodes.forEach(n => {
          n.__visible = n.name.toLowerCase().includes(term);
        });
      }
      this.graphInstance
        .nodeVisibility(node => node.__visible !== false)
        .linkVisibility(link => {
          const srcId = typeof link.source === 'object' ? link.source.id : link.source;
          const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
          const src = this.graphData.nodes.find(n => n.id === srcId);
          const tgt = this.graphData.nodes.find(n => n.id === tgtId);
          return (src && src.__visible !== false) && (tgt && tgt.__visible !== false);
        });
    },

    closeDetails() {
      this.showDetails = false;
      this.selectedNode = null;
    },

    destroy() {
      this.teardownReviewListeners();
      if (this.graphInstance && this.graphInstance._destructor) {
        this.graphInstance._destructor();
      }
    },

    // ─── LLM Review ──────────────────────────────────────────────

    async setupReviewListeners() {
      if (!window.__TAURI__ || !window.__TAURI__.event) return;
      try {
        const { listen } = window.__TAURI__.event;
        const self = this;
        this._unlistenProgress = await listen('llm-review-progress', function(event) {
          const p = event.payload;
          self.reviewPercent = p.percent;
          self.reviewStatus = p.status;
          self.reviewProcessed = p.processed;
          self.reviewRemoved = p.removed;
          self.reviewResults = (p.results || []).slice(-10);
        });
        this._unlistenComplete = await listen('llm-review-complete', function(event) {
          const p = event.payload;
          self.reviewStatus = p.message;
          self.reviewProcessed = p.processed;
          self.reviewRemoved = p.removed;
          self.reviewPercent = 100;
          self.reviewRunning = false;
          setTimeout(function() { self.reviewPanelVisible = false; }, 6000);
          self.loadData();
        });
        this._unlistenError = await listen('llm-review-error', function(event) {
          self.reviewStatus = 'Error: ' + event.payload.error;
          self.reviewRunning = false;
        });
      } catch (e) {
        console.warn('[KnowledgeGraph] Tauri event listeners unavailable:', e);
      }
    },

    teardownReviewListeners() {
      if (this._unlistenProgress) { this._unlistenProgress(); this._unlistenProgress = null; }
      if (this._unlistenComplete) { this._unlistenComplete(); this._unlistenComplete = null; }
      if (this._unlistenError) { this._unlistenError(); this._unlistenError = null; }
    },

    startLLMReview() {
      if (this.reviewRunning) return;
      this.reviewRunning = true;
      this.reviewPanelVisible = true;
      this.reviewPercent = 0;
      this.reviewStatus = 'Starting LLM review...';
      this.reviewProcessed = 0;
      this.reviewRemoved = 0;
      this.reviewResults = [];

      if (window.__TAURI__ && window.__TAURI__.invoke) {
        window.__TAURI__.invoke('llm_review_knowledge', { batch_size: 50, similarity_threshold: 0.85 })
          .catch(function(e) {
            console.error('[KnowledgeGraph] LLM review failed:', e);
          });
      } else {
        this.reviewStatus = 'LLM review requires Tauri desktop';
        this.reviewRunning = false;
      }
    },

    closeReviewPanel() {
      this.reviewPanelVisible = false;
    }
  };
}
