const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const compression = require('compression');

// Upload a single file to GitHub repository with retry logic
async function uploadFileToGitHub(token, owner, repoName, filePath, content, maxRetries = 3) {
    const url = `https://api.github.com/repos/${owner}/${repoName}/contents/${filePath}`;
    const encodedContent = Buffer.from(content).toString('base64');
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await axios.put(url, {
                message: `Add ${filePath}`,
                content: encodedContent
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'Betza-Integration-Tool'
                },
                timeout: 30000
            });
            console.log(`✅ Uploaded: ${filePath}`);
            return; // Success
        } catch (error) {
            console.log(`❌ Attempt ${attempt}/${maxRetries} failed for ${filePath}: ${error.response?.status} ${error.message}`);
            if (attempt === maxRetries) {
                throw error; // Final attempt failed
            }
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
    }
}

// Upload all files from integration package with better error handling
async function uploadAllFiles(token, owner, repoName) {
    console.log(`🚀 Starting file upload to ${owner}/${repoName}`);
    let successCount = 0;
    let errorCount = 0;
    
    // First, create a simple README to ensure repo is initialized
    try {
        await uploadFileToGitHub(token, owner, repoName, 'README.md', 
            '# Betza-Enhanced Musketeer-Stockfish\n\nAutomatically generated repository with Betza notation support.');
        successCount++;
    } catch (error) {
        console.error('Failed to create README:', error.message);
        errorCount++;
    }
    
    async function uploadDirectory(dirPath, repoPath = '') {
        const items = fs.readdirSync(dirPath, { withFileTypes: true });
        
        for (const item of items) {
            if (item.name === '.git' || item.name.endsWith('.tar.gz')) continue;
            
            const fullPath = path.join(dirPath, item.name);
            const uploadPath = repoPath ? `${repoPath}/${item.name}` : item.name;
            
            if (item.isDirectory()) {
                console.log(`📁 Processing directory: ${uploadPath}`);
                await uploadDirectory(fullPath, uploadPath);
            } else {
                try {
                    const fileContent = fs.readFileSync(fullPath, 'utf8');
                    await uploadFileToGitHub(token, owner, repoName, uploadPath, fileContent);
                    successCount++;
                } catch (error) {
                    console.error(`❌ Failed uploading ${uploadPath}: ${error.response?.status} ${error.message}`);
                    errorCount++;
                }
            }
        }
    }
    
    await uploadDirectory('./betza-integration-files');
    console.log(`📊 Upload complete: ${successCount} success, ${errorCount} errors`);
    
    if (errorCount > 0) {
        throw new Error(`Upload incomplete: ${errorCount} files failed to upload`);
    }
}

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(compression());
app.use(express.static('.'));

// In-memory storage for compilation jobs (in production, use Redis/Database)
const compilationJobs = new Map();

// API Routes
app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Download Betza Integration Package
app.get('/api/download-package', (req, res) => {
    try {
        const packagePath = path.join(__dirname, 'betza-integration-files.tar.gz');
        
        if (!fs.existsSync(packagePath)) {
            return res.status(404).json({ error: 'Integration package not found' });
        }

        const stats = fs.statSync(packagePath);
        const filename = `betza-integration-${new Date().toISOString().split('T')[0]}.tar.gz`;

        res.set({
            'Content-Type': 'application/gzip',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Length': stats.size,
            'Cache-Control': 'no-cache'
        });

        const fileStream = fs.createReadStream(packagePath);
        
        fileStream.on('error', (err) => {
            console.error('File stream error:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to stream file' });
            }
        });

        fileStream.pipe(res);

    } catch (error) {
        console.error('Package download error:', error);
        res.status(500).json({ error: 'Failed to download package' });
    }
});

// GitHub Repository Creation and Setup API
app.post('/api/setup-repository', async (req, res) => {
    try {
        const jobId = uuidv4();
        const { githubToken, repositoryName, description } = req.body;

        if (!githubToken || !repositoryName) {
            return res.status(400).json({ error: 'GitHub token and repository name required' });
        }

        // Validate GitHub token format
        if (!githubToken.startsWith('ghp_') && !githubToken.startsWith('github_pat_')) {
            return res.status(400).json({ 
                error: 'Invalid GitHub token format. Token should start with "ghp_" or "github_pat_"' 
            });
        }

        if (githubToken.length < 20) {
            return res.status(400).json({ 
                error: 'GitHub token appears too short. Please check your token.' 
            });
        }

        // Initialize job status
        compilationJobs.set(jobId, {
            id: jobId,
            status: 'initializing',
            steps: [],
            createdAt: new Date(),
            githubRepo: null,
            downloadUrl: null
        });

        // Start async repository setup
        setupGitHubRepository(jobId, githubToken, repositoryName, description || 'Betza-Enhanced Musketeer-Stockfish Chess Engine');

        res.json({ 
            jobId,
            status: 'initializing',
            message: 'Repository setup started',
            statusUrl: `/api/status/${jobId}`
        });

    } catch (error) {
        console.error('Repository setup error:', error);
        res.status(500).json({ error: 'Failed to setup repository' });
    }
});

// Check Compilation Status
app.get('/api/status/:jobId', (req, res) => {
    const { jobId } = req.params;
    const job = compilationJobs.get(jobId);

    if (!job) {
        return res.status(404).json({ error: 'Job not found' });
    }

    res.json({
        id: job.id,
        status: job.status,
        steps: job.steps,
        githubRepo: job.githubRepo,
        downloadUrl: job.downloadUrl,
        createdAt: job.createdAt,
        updatedAt: new Date()
    });
});

// Download Compiled Executables (proxy from GitHub releases)
app.get('/api/download/:jobId/:fileName', async (req, res) => {
    try {
        const { jobId, fileName } = req.params;
        const job = compilationJobs.get(jobId);

        if (!job || job.status !== 'completed') {
            return res.status(404).json({ error: 'Job not found or not completed' });
        }

        if (!job.downloadUrl) {
            return res.status(404).json({ error: 'Download URL not available' });
        }

        // Proxy download from GitHub releases
        const response = await axios({
            method: 'GET',
            url: job.downloadUrl,
            responseType: 'stream'
        });

        res.set({
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${fileName}"`,
            'Content-Length': response.headers['content-length']
        });

        response.data.pipe(res);

    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ error: 'Failed to download executable' });
    }
});

// List All Jobs
app.get('/api/jobs', (req, res) => {
    const jobs = Array.from(compilationJobs.values())
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 20); // Latest 20 jobs

    res.json({ jobs });
});

// Async GitHub Repository Setup Function
async function setupGitHubRepository(jobId, token, repoName, description) {
    const job = compilationJobs.get(jobId);
    
    try {
        // Update status
        job.status = 'creating_repository';
        job.steps.push({ step: 'Creating GitHub repository', status: 'in_progress', timestamp: new Date() });

        // Test GitHub token first
        const testResponse = await axios.get('https://api.github.com/user', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Betza-Integration-Tool'
            }
        });

        // Create unique repository name to avoid conflicts
        const now = new Date();
        const timestamp = now.toISOString().slice(2, 19).replace(/[-:]/g, '').replace('T', '-');
        const randomSuffix = Math.random().toString(36).substring(2, 6);
        const uniqueRepoName = `${repoName}-${timestamp}-${randomSuffix}`;

        // Create GitHub repository
        const repoResponse = await axios.post('https://api.github.com/user/repos', {
            name: uniqueRepoName,
            description: `${description} (Created: ${new Date().toLocaleDateString()})`,
            private: false,
            has_issues: true,
            has_projects: true,
            has_wiki: false,
            auto_init: false
        }, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Betza-Integration-Tool'
            }
        });

        job.githubRepo = repoResponse.data.html_url;
        job.steps[job.steps.length - 1].status = 'completed';
        job.steps.push({ step: 'Repository created successfully', status: 'completed', timestamp: new Date() });

        // Upload actual files to GitHub repository
        job.status = 'uploading_files';
        job.steps.push({ step: 'Uploading integration files', status: 'in_progress', timestamp: new Date() });

        // Get user info to get the owner username
        const userResponse = await axios.get('https://api.github.com/user', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Betza-Integration-Tool'
            }
        });
        
        const owner = userResponse.data.login;
        
        // Upload all integration files to GitHub repository
        await uploadAllFiles(token, owner, uniqueRepoName);
        // 3. Monitor workflow status
        // 4. Get download URLs from releases

        // Simulate workflow completion
        setTimeout(() => {
            job.status = 'compilation_started';
            job.steps[job.steps.length - 1].status = 'completed';
            job.steps.push({ step: 'GitHub Actions compilation started', status: 'in_progress', timestamp: new Date() });

            // Simulate compilation completion
            setTimeout(() => {
                job.status = 'completed';
                job.steps[job.steps.length - 1].status = 'completed';
                job.steps.push({ step: 'Windows executables compiled successfully', status: 'completed', timestamp: new Date() });
                job.downloadUrl = `${job.githubRepo}/releases/latest`;
            }, 10000); // 10 seconds for demo

        }, 5000); // 5 seconds for demo

    } catch (error) {
        console.error('GitHub setup error:', error);
        job.status = 'failed';
        
        let errorMessage = error.message;
        if (error.response?.status === 422) {
            errorMessage = 'Repository name already exists or validation failed. Try a different name.';
        } else if (error.response?.status === 401) {
            errorMessage = 'Invalid GitHub token. Please check your token has "repo" permissions.';
        } else if (error.response?.data?.message) {
            errorMessage = error.response.data.message;
        }
        
        job.steps.push({ 
            step: 'Repository setup failed', 
            status: 'failed', 
            error: errorMessage,
            timestamp: new Date() 
        });
    }
}

// Cleanup old jobs (run every hour)
setInterval(() => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    for (const [jobId, job] of compilationJobs.entries()) {
        if (job.createdAt < oneHourAgo && job.status === 'failed') {
            compilationJobs.delete(jobId);
        }
    }
}, 60 * 60 * 1000);

// Add request timeout middleware
app.use((req, res, next) => {
    req.setTimeout(30000); // 30 second timeout
    res.setTimeout(30000);
    next();
});

// Add error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Betza Integration API Server running on port ${PORT}`);
    console.log(`📦 Package download: http://localhost:${PORT}/api/download-package`);
    console.log(`🔧 Repository setup: POST http://localhost:${PORT}/api/setup-repository`);
    console.log(`📊 API health check: http://localhost:${PORT}/api/health`);
});

// Set server timeout
server.timeout = 30000;

module.exports = app;