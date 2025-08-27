// API Automation JavaScript
class BetzaAutomationAPI {
    constructor() {
        this.apiBase = window.location.origin;
        this.currentJobId = null;
        this.statusInterval = null;
        this.init();
    }

    init() {
        // Bind event listeners
        document.getElementById('download-package-btn')?.addEventListener('click', () => this.downloadPackage());
        document.getElementById('setup-repo-btn')?.addEventListener('click', () => this.setupRepository());
        
        // Bind download buttons for executables
        document.querySelectorAll('[data-file]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const fileName = e.target.getAttribute('data-file');
                this.downloadExecutable(fileName);
            });
        });

        console.log('🤖 Betza Automation API initialized');
    }

    async downloadPackage() {
        const btn = document.getElementById('download-package-btn');
        const statusDiv = document.getElementById('download-status');
        
        try {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Downloading...';
            
            statusDiv.className = 'status-message info';
            statusDiv.textContent = 'Starting package download...';

            // Create download link
            const downloadUrl = `${this.apiBase}/api/download-package`;
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = `betza-integration-${new Date().toISOString().split('T')[0]}.tar.gz`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            statusDiv.className = 'status-message success';
            statusDiv.innerHTML = '✅ Package downloaded successfully! Check your Downloads folder.';

        } catch (error) {
            console.error('Package download error:', error);
            statusDiv.className = 'status-message error';
            statusDiv.textContent = 'Failed to download package. Please try again.';
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-package"></i> Download Integration Package';
        }
    }

    async setupRepository() {
        const btn = document.getElementById('setup-repo-btn');
        const githubToken = document.getElementById('github-token').value.trim();
        const repoName = document.getElementById('repo-name').value.trim();
        const repoDescription = document.getElementById('repo-description').value.trim();

        // Validation
        if (!githubToken) {
            this.showError('GitHub token is required');
            document.getElementById('github-token').focus();
            return;
        }
        if (!githubToken.startsWith('ghp_') && !githubToken.startsWith('github_pat_')) {
            this.showError('Invalid token format. Must start with "ghp_" or "github_pat_"');
            document.getElementById('github-token').focus();
            return;
        }
        if (githubToken.length < 20) {
            this.showError('Token appears too short. Please check your GitHub token.');
            document.getElementById('github-token').focus();
            return;
        }
        if (!repoName) {
            this.showError('Repository name is required');
            document.getElementById('repo-name').focus();
            return;
        }

        try {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Setting up repository...';

            const response = await fetch(`${this.apiBase}/api/setup-repository`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    githubToken,
                    repositoryName: repoName,
                    description: repoDescription
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to setup repository');
            }

            this.currentJobId = result.jobId;
            this.showCompilationStatus();
            this.startStatusMonitoring();

        } catch (error) {
            console.error('Repository setup error:', error);
            this.showError(`Setup failed: ${error.message}`);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-cog"></i> Setup Repository & Start Compilation';
        }
    }

    showCompilationStatus() {
        const statusDiv = document.getElementById('compilation-status');
        statusDiv.classList.remove('hidden');
        statusDiv.scrollIntoView({ behavior: 'smooth' });
    }

    async startStatusMonitoring() {
        if (!this.currentJobId) return;

        // Initial status check
        await this.checkStatus();

        // Set up interval for status updates
        this.statusInterval = setInterval(async () => {
            await this.checkStatus();
        }, 3000); // Check every 3 seconds
    }

    async checkStatus() {
        if (!this.currentJobId) return;

        try {
            const response = await fetch(`${this.apiBase}/api/status/${this.currentJobId}`);
            const job = await response.json();

            if (!response.ok) {
                throw new Error(job.error || 'Failed to check status');
            }

            this.updateStatusUI(job);

            // Stop monitoring if job is completed or failed
            if (job.status === 'completed' || job.status === 'failed') {
                if (this.statusInterval) {
                    clearInterval(this.statusInterval);
                    this.statusInterval = null;
                }

                if (job.status === 'completed') {
                    this.showDownloadSection();
                }
            }

        } catch (error) {
            console.error('Status check error:', error);
        }
    }

    updateStatusUI(job) {
        // Update job status badge
        const statusBadge = document.getElementById('job-status');
        statusBadge.textContent = job.status.replace('_', ' ');
        statusBadge.className = `status-badge ${job.status}`;

        // Update job info
        document.getElementById('current-job-id').textContent = job.id;
        document.getElementById('job-created').textContent = new Date(job.createdAt).toLocaleString();

        if (job.githubRepo) {
            const repoLink = document.getElementById('github-repo-link');
            repoLink.href = job.githubRepo;
            repoLink.textContent = job.githubRepo;
        }

        // Update progress steps
        const progressDiv = document.getElementById('progress-steps');
        progressDiv.innerHTML = '';

        job.steps.forEach(step => {
            const stepDiv = document.createElement('div');
            stepDiv.className = 'progress-step';

            const icon = this.getStepIcon(step.status);
            stepDiv.innerHTML = `
                <span class="step-icon ${step.status}">${icon}</span>
                <div class="step-info">
                    <strong>${step.step}</strong>
                    <div style="font-size: 12px; color: #666;">
                        ${new Date(step.timestamp).toLocaleTimeString()}
                        ${step.error ? `<br><span style="color: #dc3545;">Error: ${step.error}</span>` : ''}
                    </div>
                </div>
            `;

            progressDiv.appendChild(stepDiv);
        });
    }

    getStepIcon(status) {
        switch (status) {
            case 'completed': return '✅';
            case 'in_progress': return '⏳';
            case 'failed': return '❌';
            default: return '⭕';
        }
    }

    showDownloadSection() {
        const downloadSection = document.getElementById('download-section');
        downloadSection.classList.remove('hidden');
        downloadSection.scrollIntoView({ behavior: 'smooth' });
    }

    async downloadExecutable(fileName) {
        if (!this.currentJobId) {
            this.showError('No active job for download');
            return;
        }

        try {
            const downloadUrl = `${this.apiBase}/api/download/${this.currentJobId}/${fileName}`;
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } catch (error) {
            console.error('Download error:', error);
            this.showError(`Download failed: ${error.message}`);
        }
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'status-message error';
        errorDiv.textContent = message;
        errorDiv.style.position = 'fixed';
        errorDiv.style.top = '20px';
        errorDiv.style.right = '20px';
        errorDiv.style.zIndex = '1000';
        errorDiv.style.maxWidth = '400px';
        
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            if (document.body.contains(errorDiv)) {
                document.body.removeChild(errorDiv);
            }
        }, 5000);
    }
}

// Initialize the API when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.betzaAPI = new BetzaAutomationAPI();
});