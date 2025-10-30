// worker.js: The scheduled script run by GitHub Actions

const { Octokit } = require("@octokit/rest");
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// --- FILEPATHS ---
// These paths must match the file locations defined in Step 3
const TEAMS_FILE = path.resolve(__dirname, 'data/teams.json');
const LEADERBOARD_FILE = path.resolve(__dirname, 'data/leaderboard.json');
const HISTORY_FILE = path.resolve(__dirname, 'data/history.json');

// --- GITHUB SETUP ---
// GH_PAT is securely accessed from the GitHub Actions environment
const octokit = new Octokit({
    auth: process.env.GH_PAT,
});

// Helper function to read a JSON file (or return default if not found)
function readJson(filePath, defaultValue) {
    try {
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(content);
        }
    } catch (e) {
        console.error(`Error reading ${filePath}:`, e);
    }
    return defaultValue;
}

// Helper function to commit updated JSON files
async function commitFiles(newLeaderboard, newHistory) {
    fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(newLeaderboard, null, 2));
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(newHistory, null, 2));

    const commitMessage = `Automated data update: ${new Date().toISOString()}`;

    // GitHub Actions user for committing
    const gitUser = "github-actions[bot]";
    const gitEmail = "41898282+github-actions[bot]@users.noreply.github.com";

    console.log("Committing updated files...");
    const commands = [
        `git config --global user.email "${gitEmail}"`,
        `git config --global user.name "${gitUser}"`,
        `git add ${LEADERBOARD_FILE} ${HISTORY_FILE}`,
        `git commit -m "${commitMessage}" --allow-empty`,
        `git push`
    ].join(' && ');

    return new Promise((resolve, reject) => {
        exec(commands, (err, stdout, stderr) => {
            if (err) {
                console.error(`Commit Error: ${err.message}`);
                console.error(stderr);
                // Exit with non-zero code to fail the Action
                return reject(new Error(`Failed to commit: ${err.message}`));
            }
            console.log(stdout);
            resolve(stdout);
        });
    });
}

async function getCommitsInWindow(repoOwner, repoName, sinceTime, untilTime) {
    try {
        const response = await octokit.repos.listCommits({
            owner: repoOwner,
            repo: repoName,
            since: sinceTime,
            until: untilTime,
            per_page: 100,
        });
        return response.data.length;
    } catch (error) {
        // Log the error but return 0 commits so the tracker continues
        console.error(`Repo Error (${repoOwner}/${repoName}): ${error.status || 'API'} ${error.message}`);
        return 0;
    }
}

async function runTracker() {
    console.log("Starting 5-minute commit check...");
    
    // --- 1. Define Time Window and Load Data ---
    const now = new Date();
    // 300000ms = 5 minutes
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60000); 
    const sinceTime = fiveMinutesAgo.toISOString();
    const untilTime = now.toISOString();

    const teamsConfig = readJson(TEAMS_FILE, []);
    let currentLeaderboard = readJson(LEADERBOARD_FILE, []);
    let history = readJson(HISTORY_FILE, []);

    const newHistoryEntry = {
        time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        timestamp: now.getTime(),
        teams: {},
        total: 0
    };

    const leaderboardMap = new Map(currentLeaderboard.map(t => [t.id, t]));
    
    // --- 2. Process Commits for Each Team ---
    for (const team of teamsConfig) {
        let teamWindowCommits = 0;
        
        // Fetch commits from ALL repos belonging to the team
        for (const repoPath of team.repos) {
            const [rOwner, rName] = repoPath.split('/');
            const count = await getCommitsInWindow(rOwner, rName, sinceTime, untilTime);
            teamWindowCommits += count;
        }

        // --- 3. Update Data Structures ---
        
        // a. Update Leaderboard totals (using current totals or 0 if new)
        let leaderboardEntry = leaderboardMap.get(team.id) || { 
            id: team.id, 
            name: team.name, 
            total_commits: 0,
            color: team.color 
        };
        leaderboardEntry.total_commits += teamWindowCommits;
        leaderboardMap.set(team.id, leaderboardEntry);

        // b. Update History Entry
        newHistoryEntry.teams[team.id] = teamWindowCommits;
        newHistoryEntry.total += teamWindowCommits;
    }

    // Finalize Leaderboard (sorted list)
    let newLeaderboard = Array.from(leaderboardMap.values()).sort((a, b) => b.total_commits - a.total_commits);

    // Finalize History (keep only the last 50 entries to prevent file size bloat)
    history.push(newHistoryEntry);
    history = history.slice(-50); // Keeps ~4 hours of data

    // --- 4. Commit Updated Files ---
    await commitFiles(newLeaderboard, history);

    console.log(`Commit fetching complete. Total window commits: ${newHistoryEntry.total}`);
}

runTracker().catch(error => {
    console.error("Tracker failed to complete successfully.");
    process.exit(1);
});
