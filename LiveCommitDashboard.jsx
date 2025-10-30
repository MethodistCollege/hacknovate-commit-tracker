import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

// --- CONFIGURATION ---
// *** THIS URL HAS BEEN CORRECTED FOR YOUR REPOSITORY ***
// It points to the raw content of your GitHub repo, where the action commits the JSON files.
const RAW_URL_BASE = "https://raw.githubusercontent.com/MethodistCollege/hacknovate-commit-tracker/main/"; 

// We add a unique cache-buster (Date.now()) to ensure the dashboard always fetches the latest file
const LEADERBOARD_URL = `${RAW_URL_BASE}data/leaderboard.json?cache=${Date.now()}`;
const HISTORY_URL = `${RAW_URL_BASE}data/history.json?cache=${Date.now()}`;

// --- UTILITY COMPONENTS ---

const TimeSeriesCard = ({ title, children, className = '' }) => (
  <div className={`bg-white shadow-xl rounded-xl p-6 transition-all duration-300 hover:shadow-2xl ${className}`}>
    <h2 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">{title}</h2>
    {children}
  </div>
);

// --- MAIN DASHBOARD APP ---
const App = () => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);

  // Memoize team data for graph legends/lines from the leaderboard config
  const teamConfigs = useMemo(() => {
    return leaderboard.map(team => ({
      id: team.id,
      name: team.name,
      color: team.color || '#4c51bf' // Fallback color
    }));
  }, [leaderboard]);

  // --- Data Fetching Logic (Polling) ---
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Leaderboard (Total Scores)
      const leaderboardResponse = await fetch(LEADERBOARD_URL);
      const newLeaderboard = await leaderboardResponse.json();
      setLeaderboard(newLeaderboard);

      // 2. Fetch History (Time-Series Data)
      const historyResponse = await fetch(HISTORY_URL);
      const rawHistory = await historyResponse.json();
      
      // 3. Transform history data for Recharts
      const transformedHistory = rawHistory.map(entry => {
        const base = { time: entry.time, total: entry.total };
        // Flatten team-specific counts into the base object
        Object.entries(entry.teams).forEach(([id, count]) => {
          base[id] = count;
        });
        return base;
      });
      setHistoryData(transformedHistory);
      setLastUpdate(new Date().toLocaleTimeString());

    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Setup polling every 30 seconds
  useEffect(() => {
    fetchData(); // Initial load
    const intervalId = setInterval(fetchData, 30000); // Poll every 30 seconds

    return () => clearInterval(intervalId); // Cleanup on component unmount
  }, []);

  const totalHackathonCommits = leaderboard.reduce((sum, team) => sum + team.total_commits, 0);

  return (
    <div className="min-h-screen bg-gray-900 p-4 sm:p-8 font-sans text-white">
      {/* Tailwind and Font Links (for simple CSS loading) */}
      <script src="https://cdn.tailwindcss.com"></script>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet" />
      <style>{`
        .font-sans { font-family: 'Inter', sans-serif; }
        .recharts-default-tooltip {
          background-color: #1f2937 !important;
          border: 1px solid #4b5563 !important;
          color: white !important;
          padding: 8px;
          border-radius: 6px;
          opacity: 0.95;
        }
      `}</style>
      
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-extrabold text-indigo-400 mb-2">
          Hacknovate 2025: Live Commit Tracker
        </h1>
        <p className="text-sm text-gray-400 mb-6 flex justify-between items-center">
          Data via GitHub Actions (Updates every 5 minutes)
          <span className="text-xs text-yellow-400">Dashboard Last Refreshed: {lastUpdate || 'Loading...'}</span>
        </p>

        {/* STATS HEADER */}
        <div className="bg-gray-800 p-4 rounded-xl shadow-lg mb-8">
            <p className="text-2xl font-semibold text-gray-200">Total Hackathon Commits</p>
            <p className="text-5xl font-extrabold text-green-400 mt-1">{totalHackathonCommits}</p>
        </div>


        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* LEADERBOARD (COL 1) */}
            <div className="lg:col-span-1">
                <TimeSeriesCard title="Overall Leaderboard" className="bg-gray-800 border border-gray-700 h-full">
                    {loading && <p className="text-indigo-400">Loading leaderboard...</p>}
                    <div className="space-y-3">
                        {leaderboard.map((team, index) => (
                            <div key={team.id} className={`leaderboard-item flex items-center justify-between p-4 rounded-lg shadow-md ${index === 0 ? 'bg-yellow-600/30 border-2 border-yellow-400' : index === 1 ? 'bg-gray-600/30 border border-gray-500' : index === 2 ? 'bg-red-600/30 border border-red-500' : 'bg-gray-700 hover:bg-gray-600'}`}>
                                <div className="flex items-center space-x-4">
                                    <span className={`text-xl font-extrabold w-8 text-center ${index === 0 ? 'text-yellow-300' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-red-300' : 'text-gray-400'}`}>
                                      {index + 1}
                                    </span>
                                    <span className="text-lg font-medium text-white">{team.name}</span>
                                </div>
                                <span className="text-2xl font-extrabold text-indigo-400">{team.total_commits || 0}</span>
                            </div>
                        ))}
                    </div>
                </TimeSeriesCard>
            </div>

            {/* CHART (COL 2 & 3) */}
            <TimeSeriesCard title="5-Minute Commit Activity Trend" className="lg:col-span-2 bg-gray-800 border border-gray-700 min-h-[450px] relative">
                {loading && (
                    <div className="absolute inset-0 bg-gray-800/80 flex items-center justify-center rounded-xl z-10">
                        <svg className="animate-spin -ml-1 mr-3 h-8 w-8 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="text-indigo-400 font-medium">Fetching live data...</span>
                    </div>
                )}
                
                <ResponsiveContainer width="100%" height={380}>
                    <LineChart
                        data={historyData}
                        margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#4b5563" />
                        <XAxis dataKey="time" stroke="#9ca3af" />
                        <YAxis allowDecimals={false} stroke="#9ca3af" />
                        <Tooltip />
                        <Legend />

                        {/* Dynamically render lines for all active teams */}
                        {teamConfigs.map((team, index) => (
                            <Line 
                                key={team.id}
                                type="monotone" 
                                dataKey={team.id} 
                                name={team.name} 
                                stroke={team.color} 
                                strokeWidth={3} 
                                dot={{ r: 4 }} 
                                activeDot={{ r: 8 }} 
                            />
                        ))}
                        
                    </LineChart>
                </ResponsiveContainer>
            </TimeSeriesCard>
        </div>
      </div>
    </div>
  );
};

export default App;
