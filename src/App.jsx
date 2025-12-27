import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, onSnapshot, 
  query, orderBy, deleteDoc, doc, getDoc, setDoc 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, 
  signInWithCustomToken 
} from 'firebase/auth';
import { 
  Play, Pause, Volume2, Maximize, LogOut, Upload, 
  Search, Plus, X, List, Share2, Film, Lock, Image as ImageIcon,
  ExternalLink, ChevronRight, Check
} from 'lucide-react';

// --- 設定區域：請將您的 Firebase 設定貼在這裡 ---
// 1. 請從 Firebase Console > Project Settings 複製您的設定
// 2. 將內容填入下方的引號中
const firebaseConfig = {
  apiKey: "AIzaSyAYhJ0BeSwR0i-x9HHAVXR2p_1dD0l-an4",
  authDomain: "video-faa49.firebaseapp.com",
  projectId: "video-faa49",
  storageBucket: "video-faa49.firebasestorage.app",
  messagingSenderId: "648988955584",
  appId: "1:648988955584:web:47ffd523c7f73a51f02e25",
  measurementId: "G-LTCZEXHP3B"
};

// --- Firebase Initialization Logic ---
// 這裡會自動判斷：如果是在預覽環境就用預覽設定，如果是您自己執行就會用上面的 myFirebaseConfig
const configToUse = (typeof __firebase_config !== 'undefined') 
  ? JSON.parse(__firebase_config) 
  : myFirebaseConfig;

const app = initializeApp(configToUse);
const auth = getAuth(app);
const db = getFirestore(app);

// 如果是使用自己的 Firebase，我們使用 'video-app' 作為資料夾名稱，而不是隨機 ID
const appId = typeof __app_id !== 'undefined' ? __app_id : 'video-app';

// --- Hardcoded Credentials ---
const ADMIN_USER = "admin";
const ADMIN_PASS = "password123";

// --- Components ---

// 1. Login Component
const LoginScreen = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    if (username === ADMIN_USER && password === ADMIN_PASS) {
      onLogin();
    } else {
      setError('帳號或密碼錯誤');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-96 border border-gray-700">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
            <Lock className="w-8 h-8 text-white" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-center mb-6">管理員登入</h2>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">帳號</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-blue-500"
              placeholder="輸入 admin"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">密碼</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-blue-500"
              placeholder="輸入 password123"
            />
          </div>
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button 
            type="submit" 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-semibold transition-colors"
          >
            登入系統
          </button>
        </form>
        <div className="mt-4 text-xs text-gray-500 text-center">
          預設帳號: admin / 密碼: password123
        </div>
      </div>
    </div>
  );
};

// 2. Main Application
export default function App() {
  const [user, setUser] = useState(null); // Firebase Auth User
  const [isAdmin, setIsAdmin] = useState(false); // Local App Logic Admin
  const [videos, setVideos] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [activeTab, setActiveTab] = useState('home'); // home, playlists, shared
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState(null);
  
  // Modals & Overlays
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [currentVideo, setCurrentVideo] = useState(null); // For player
  const [sharedPlaylistId, setSharedPlaylistId] = useState(null); // If viewing a shared link
  const [sharedPlaylistData, setSharedPlaylistData] = useState(null);

  // --- Auth & Init Logic ---
  useEffect(() => {
    const initAuth = async () => {
      // 優先嘗試使用環境變數中的 token (預覽環境用)
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        try {
          await signInWithCustomToken(auth, __initial_auth_token);
        } catch (e) {
          console.warn("Custom token failed, trying anonymous", e);
          await signInAnonymously(auth);
        }
      } else {
        // 如果是您自己的環境，或是沒有 token，則使用匿名登入
        // 請確保 Firebase Console > Authentication > Sign-in method > Anonymous 已啟用
        try {
          await signInAnonymously(auth);
        } catch (e) {
          console.error("登入失敗: 請檢查 Firebase Console 是否已啟用 Authentication 中的『匿名 (Anonymous)』登入。", e);
        }
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    
    // Check LocalStorage for "Remember Me"
    const savedLogin = localStorage.getItem('app_is_admin');
    if (savedLogin === 'true') {
      setIsAdmin(true);
    }
    
    // Check URL Hash for Shared Playlist (Simulation of Routing)
    // Format: #playlist/PLAYLIST_ID
    const checkHash = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#playlist/')) {
        const id = hash.split('/')[1];
        setSharedPlaylistId(id);
        setActiveTab('shared');
      }
    };
    checkHash();
    window.addEventListener('hashchange', checkHash);

    return () => {
      unsubscribe();
      window.removeEventListener('hashchange', checkHash);
    };
  }, []);

  // --- Data Fetching ---
  useEffect(() => {
    if (!user) return;

    // 1. Fetch Videos
    // 注意：如果您使用自己的 Firebase，資料路徑會變成 artifacts/video-app/public/data/videos
    const videosRef = collection(db, 'artifacts', appId, 'public', 'data', 'videos');
    const qVideos = query(videosRef, orderBy('createdAt', 'desc'));
    
    const unsubVideos = onSnapshot(qVideos, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setVideos(data);
    }, (err) => {
        console.error("Videos Error:", err);
        if (err.code === 'permission-denied') {
            alert("讀取失敗：權限不足。請檢查 Firestore Rules 是否已設定為允許讀取 (allow read, write: if request.auth != null;)");
        }
    });

    // 2. Fetch Playlists
    const playlistsRef = collection(db, 'artifacts', appId, 'public', 'data', 'playlists');
    const qPlaylists = query(playlistsRef, orderBy('createdAt', 'desc'));
    const unsubPlaylists = onSnapshot(qPlaylists, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPlaylists(data);
    }, (err) => console.error("Playlists Error:", err));

    return () => {
      unsubVideos();
      unsubPlaylists();
    };
  }, [user]);

  // --- Load Shared Playlist Data ---
  useEffect(() => {
    if (sharedPlaylistId && user) {
      const fetchPlaylist = async () => {
        try {
          const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'playlists', sharedPlaylistId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setSharedPlaylistData({ id: docSnap.id, ...docSnap.data() });
          } else {
            alert('找不到該播放清單');
            setSharedPlaylistId(null);
            setActiveTab('home');
          }
        } catch (e) {
          console.error("Error fetching playlist:", e);
        }
      };
      fetchPlaylist();
    }
  }, [sharedPlaylistId, user]);

  // --- Handlers ---
  const handleAdminLogin = () => {
    setIsAdmin(true);
    localStorage.setItem('app_is_admin', 'true');
    // If we were on a shared link, go home
    if (activeTab === 'shared') setActiveTab('home');
  };

  const handleLogout = () => {
    setIsAdmin(false);
    localStorage.removeItem('app_is_admin');
    setActiveTab('home');
  };

  // --- Derived State ---
  const allTags = useMemo(() => {
    const tags = new Set();
    videos.forEach(v => v.tags?.forEach(t => tags.add(t)));
    return Array.from(tags);
  }, [videos]);

  const filteredVideos = useMemo(() => {
    let source = videos;
    
    // If in shared mode, only show playlist videos
    if (activeTab === 'shared' && sharedPlaylistData) {
      source = videos.filter(v => sharedPlaylistData.videoIds.includes(v.id));
    } else if (activeTab === 'shared' && !sharedPlaylistData) {
      return [];
    }

    return source.filter(v => {
      const matchesSearch = v.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTag = selectedTag ? v.tags?.includes(selectedTag) : true;
      return matchesSearch && matchesTag;
    });
  }, [videos, searchQuery, selectedTag, activeTab, sharedPlaylistData]);

  // --- Render Logic ---
  
  if (!user) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">正在連線至資料庫...</div>;

  // If not logged in and not viewing a shared playlist, show Login
  if (!isAdmin && activeTab !== 'shared') {
    return <LoginScreen onLogin={handleAdminLogin} />;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">
      
      {/* --- Top Navigation --- */}
      <nav className="bg-gray-800 border-b border-gray-700 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => {
                setActiveTab('home');
                setSharedPlaylistId(null);
                setSearchQuery('');
                setSelectedTag(null);
                window.location.hash = ''; 
              }}>
              <div className="bg-red-600 p-1.5 rounded-lg">
                <Film className="w-6 h-6 text-white" />
              </div>
              <span className="font-bold text-xl tracking-tight">
                {activeTab === 'shared' ? '分享模式' : '影音管理系統'}
              </span>
            </div>

            {/* Search Bar */}
            <div className="flex-1 max-w-md mx-4 hidden md:block">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  className="block w-full pl-10 pr-3 py-2 border border-gray-600 rounded-full leading-5 bg-gray-700 text-gray-300 placeholder-gray-400 focus:outline-none focus:bg-gray-600 focus:border-blue-500 transition duration-150 ease-in-out sm:text-sm"
                  placeholder="搜尋影片名稱或標籤..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              {activeTab === 'shared' ? (
                <button 
                  onClick={() => {
                    setActiveTab('home');
                    setSharedPlaylistId(null);
                    window.location.hash = '';
                  }}
                  className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                >
                  回登入頁面
                </button>
              ) : (
                <>
                  <button 
                    onClick={() => setActiveTab('home')}
                    className={`px-3 py-2 rounded-md text-sm font-medium ${activeTab === 'home' ? 'bg-gray-900 text-white' : 'text-gray-300 hover:text-white hover:bg-gray-700'}`}
                  >
                    影片庫
                  </button>
                  <button 
                    onClick={() => setActiveTab('playlists')}
                    className={`px-3 py-2 rounded-md text-sm font-medium ${activeTab === 'playlists' ? 'bg-gray-900 text-white' : 'text-gray-300 hover:text-white hover:bg-gray-700'}`}
                  >
                    播放清單
                  </button>
                  <button 
                    onClick={() => setShowUploadModal(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    上傳影片
                  </button>
                  <button 
                    onClick={handleLogout}
                    className="text-gray-400 hover:text-red-400 ml-2"
                    title="登出"
                  >
                    <LogOut className="w-6 h-6" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* --- Main Content Area --- */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Mobile Search (Visible only on small screens) */}
        <div className="md:hidden mb-6">
          <div className="relative">
             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-600 rounded-lg bg-gray-700 text-white"
              placeholder="搜尋..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* View: Playlist Manager */}
        {activeTab === 'playlists' && (
          <PlaylistManager 
            videos={videos} 
            playlists={playlists} 
            appId={appId}
            onOpenShared={(id) => {
              window.location.hash = `#playlist/${id}`;
            }} 
          />
        )}

        {/* View: Video Grid (Home or Shared) */}
        {(activeTab === 'home' || activeTab === 'shared') && (
          <>
            {/* Context Header */}
            {activeTab === 'shared' && sharedPlaylistData && (
              <div className="mb-8 p-6 bg-gray-800 rounded-xl border border-gray-700">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-3xl font-bold text-white mb-2">{sharedPlaylistData.title}</h2>
                    <p className="text-gray-400">
                      這是一個唯讀的分享清單。包含 {filteredVideos.length} 部影片。
                    </p>
                  </div>
                  <div className="bg-blue-900/50 text-blue-200 px-4 py-1 rounded-full text-xs border border-blue-700">
                    僅供檢視
                  </div>
                </div>
              </div>
            )}

            {/* Tags Filter */}
            {allTags.length > 0 && (
              <div className="mb-6 flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedTag(null)}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${!selectedTag ? 'bg-white text-gray-900' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                >
                  全部
                </button>
                {allTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                    className={`px-3 py-1 rounded-full text-sm transition-colors ${tag === selectedTag ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}

            {/* Grid */}
            {filteredVideos.length === 0 ? (
              <div className="text-center py-20">
                <div className="inline-block p-4 rounded-full bg-gray-800 mb-4">
                  <Film className="w-12 h-12 text-gray-600" />
                </div>
                <h3 className="text-xl font-medium text-gray-400">沒有找到影片</h3>
                <p className="text-gray-500 mt-2">試試看不同的關鍵字或上傳新影片</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredVideos.map(video => (
                  <VideoCard 
                    key={video.id} 
                    video={video} 
                    onClick={() => setCurrentVideo(video)} 
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* --- Modals --- */}
      
      {/* 1. Upload Modal */}
      {showUploadModal && (
        <UploadModal 
          onClose={() => setShowUploadModal(false)} 
          appId={appId}
          existingTags={allTags}
        />
      )}

      {/* 2. Video Player Modal */}
      {currentVideo && (
        <PlayerModal 
          video={currentVideo} 
          onClose={() => setCurrentVideo(null)} 
        />
      )}

    </div>
  );
}

// --- Sub-Components ---

// Video Card Component
const VideoCard = ({ video, onClick }) => {
  return (
    <div 
      className="bg-gray-800 rounded-lg overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 group cursor-pointer border border-gray-700 flex flex-col h-full"
      onClick={onClick}
    >
      <div className="relative aspect-video bg-black overflow-hidden">
        <img 
          src={video.thumbUrl || "https://placehold.co/600x400/000000/FFF?text=No+Thumbnail"} 
          alt={video.title} 
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80 group-hover:opacity-100"
        />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-white/20 backdrop-blur-sm p-3 rounded-full">
            <Play className="w-8 h-8 text-white fill-current" />
          </div>
        </div>
        <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-0.5 text-xs text-white rounded">
          Video
        </div>
      </div>
      <div className="p-4 flex flex-col flex-1">
        <h3 className="text-lg font-semibold text-white line-clamp-2 mb-1 group-hover:text-blue-400 transition-colors">
          {video.title}
        </h3>
        <div className="flex flex-wrap gap-1 mb-2">
          {video.tags?.map(tag => (
            <span key={tag} className="text-xs text-blue-300 bg-blue-900/30 px-1.5 py-0.5 rounded">
              #{tag}
            </span>
          ))}
        </div>
        <p className="text-gray-400 text-sm line-clamp-2 mb-auto">
          {video.description || "無描述"}
        </p>
      </div>
    </div>
  );
};

// Player Modal Component
const PlayerModal = ({ video, onClose }) => {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Play/Pause Toggle
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  // Volume Change
  const handleVolumeChange = (e) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    if (videoRef.current) videoRef.current.volume = vol;
  };

  // Update Time
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      setDuration(videoRef.current.duration || 0);
    }
  };

  // Seek
  const handleSeek = (e) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl bg-gray-900 rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-800">
          <h2 className="text-xl font-bold text-white truncate pr-4">{video.title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Video Area */}
        <div className="relative bg-black flex-1 flex items-center justify-center group">
          <video
            ref={videoRef}
            src={video.url}
            className="max-h-[60vh] w-full"
            onTimeUpdate={handleTimeUpdate}
            onEnded={() => setIsPlaying(false)}
            onClick={togglePlay}
          >
            您的瀏覽器不支援影片播放。
          </video>
          
          {/* Big Center Play Button (only when paused) */}
          {!isPlaying && (
             <div 
               className="absolute inset-0 flex items-center justify-center cursor-pointer bg-black/10"
               onClick={togglePlay}
             >
                <div className="bg-white/20 hover:bg-white/30 backdrop-blur-md p-6 rounded-full transition-all scale-100 hover:scale-110">
                   <Play className="w-12 h-12 text-white fill-current translate-x-1" />
                </div>
             </div>
          )}
        </div>

        {/* Controls */}
        <div className="p-4 bg-gray-800">
          {/* Progress Bar */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs text-gray-400 w-10 text-right">{formatTime(currentTime)}</span>
            <input 
              type="range" 
              min="0" 
              max={duration || 100} 
              value={currentTime} 
              onChange={handleSeek}
              className="flex-1 h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full"
            />
            <span className="text-xs text-gray-400 w-10">{formatTime(duration)}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={togglePlay} className="text-white hover:text-blue-400">
                {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current" />}
              </button>
              
              <div className="flex items-center gap-2 group">
                <Volume2 className="w-5 h-5 text-gray-400" />
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.1" 
                  value={volume} 
                  onChange={handleVolumeChange}
                  className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
                />
              </div>
            </div>

            {/* Video Info (Sidebar like) */}
            <div className="text-gray-400 text-sm hidden sm:block">
              {video.tags?.map(t => `#${t} `)}
            </div>
          </div>
        </div>
        
        {/* Description Box */}
        <div className="p-4 bg-gray-900 border-t border-gray-800 overflow-y-auto max-h-32">
            <h4 className="text-sm font-semibold text-gray-300 mb-1">說明</h4>
            <p className="text-sm text-gray-400 whitespace-pre-wrap">{video.description}</p>
        </div>
      </div>
    </div>
  );
};

// Upload Modal
const UploadModal = ({ onClose, appId, existingTags }) => {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [thumbUrl, setThumbUrl] = useState('');
  const [tags, setTags] = useState([]);
  const [newTag, setNewTag] = useState('');
  const [loading, setLoading] = useState(false);

  // Helper for file to base64 (since we are avoiding direct Storage bucket complexity for this demo)
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  };

  const handleThumbUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 500000) { // Limit to 500kb for Firestore storage
        alert("縮圖太大，請使用小於 500KB 的圖片 (Demo限制)");
        return;
      }
      const base64 = await fileToBase64(file);
      setThumbUrl(base64);
    }
  };

  const handleAddTag = () => {
    if (newTag && !tags.includes(newTag)) {
      setTags([...tags, newTag]);
      setNewTag('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'videos'), {
        title,
        description: desc,
        url: videoUrl, // In a real app, upload file to Storage, get URL
        thumbUrl, // In a real app, upload file to Storage, get URL
        tags,
        createdAt: new Date().toISOString()
      });
      onClose();
    } catch (error) {
      console.error(error);
      alert("上傳失敗：" + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-xl w-full max-w-2xl p-6 border border-gray-700 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Upload className="w-5 h-5 text-blue-500" /> 上傳新影片
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">影片標題</label>
                <input 
                  required
                  type="text" 
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">影片 URL (MP4 連結)</label>
                <input 
                  required
                  type="url" 
                  placeholder="https://example.com/video.mp4"
                  value={videoUrl}
                  onChange={e => setVideoUrl(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  * 由於 Demo 限制，請直接貼上公開的 MP4 連結。
                  <br/>
                  測試連結: <code>https://www.w3schools.com/html/mov_bbb.mp4</code>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">影片說明</label>
                <textarea 
                  rows="4"
                  value={desc}
                  onChange={e => setDesc(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                ></textarea>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">縮圖 (PNG/JPG)</label>
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-600 border-dashed rounded-lg cursor-pointer bg-gray-700 hover:bg-gray-600">
                    {thumbUrl ? (
                      <img src={thumbUrl} alt="Preview" className="h-full object-contain" />
                    ) : (
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <ImageIcon className="w-8 h-8 text-gray-400 mb-2" />
                        <p className="text-sm text-gray-400">點擊上傳縮圖</p>
                      </div>
                    )}
                    <input type="file" className="hidden" accept="image/png, image/jpeg" onChange={handleThumbUpload} />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">標籤 (可擴充)</label>
                <div className="flex gap-2 mb-2">
                  <input 
                    type="text" 
                    value={newTag}
                    onChange={e => setNewTag(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                    placeholder="輸入標籤後按 Enter"
                    className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                  <button 
                    type="button" 
                    onClick={handleAddTag}
                    className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-2 rounded"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 min-h-[40px] bg-gray-900/50 p-2 rounded border border-gray-700">
                  {tags.map(tag => (
                    <span key={tag} className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                      {tag}
                      <button type="button" onClick={() => setTags(tags.filter(t => t !== tag))} className="hover:text-red-200">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {tags.length === 0 && <span className="text-gray-500 text-sm italic">尚無標籤</span>}
                </div>
                {/* Suggestions */}
                {existingTags.length > 0 && (
                   <div className="mt-2 text-xs text-gray-500">
                      常用: {existingTags.slice(0, 5).map(t => (
                        <span key={t} onClick={() => !tags.includes(t) && setTags([...tags, t])} className="cursor-pointer hover:text-blue-400 mr-2">
                           #{t}
                        </span>
                      ))}
                   </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-700">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white mr-4"
            >
              取消
            </button>
            <button 
              type="submit" 
              disabled={loading || !videoUrl || !title}
              className={`px-6 py-2 bg-blue-600 text-white rounded font-medium ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'}`}
            >
              {loading ? '處理中...' : '確認上傳'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Playlist Manager
const PlaylistManager = ({ videos, playlists, appId, onOpenShared }) => {
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [selectedVideoIds, setSelectedVideoIds] = useState([]);
  const [justCopied, setJustCopied] = useState(null);

  const handleCreate = async () => {
    if (!newTitle || selectedVideoIds.length === 0) return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'playlists'), {
        title: newTitle,
        videoIds: selectedVideoIds,
        createdAt: new Date().toISOString()
      });
      setShowCreate(false);
      setNewTitle('');
      setSelectedVideoIds([]);
    } catch (e) {
      console.error(e);
      alert('建立失敗');
    }
  };

  const toggleSelect = (id) => {
    if (selectedVideoIds.includes(id)) {
      setSelectedVideoIds(selectedVideoIds.filter(v => v !== id));
    } else {
      setSelectedVideoIds([...selectedVideoIds, id]);
    }
  };

  const copyLink = (id) => {
    // Generate a fake but usable link for the demo environment
    const link = `${window.location.origin}${window.location.pathname}#playlist/${id}`;
    
    // In iframe, navigator.clipboard might fail, use fallback
    try {
       const textArea = document.createElement("textarea");
       textArea.value = link;
       document.body.appendChild(textArea);
       textArea.select();
       document.execCommand('copy');
       document.body.removeChild(textArea);
       setJustCopied(id);
       setTimeout(() => setJustCopied(null), 2000);
    } catch (err) {
       prompt("請手動複製連結:", link);
    }
  };

  const deletePlaylist = async (id) => {
    if(confirm('確定要刪除這個清單嗎？')) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'playlists', id));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">我的播放清單</h2>
        <button 
          onClick={() => setShowCreate(true)} 
          className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> 建立新清單
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {playlists.map(pl => (
          <div key={pl.id} className="bg-gray-800 rounded-lg p-6 border border-gray-700 flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold truncate flex-1">{pl.title}</h3>
              <div className="flex gap-2">
                 <button 
                  onClick={() => deletePlaylist(pl.id)} 
                  className="text-gray-500 hover:text-red-500 p-1"
                  title="刪除"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <p className="text-gray-400 text-sm mb-4">
              包含 {pl.videoIds?.length || 0} 部影片
            </p>

            <div className="mt-auto space-y-2">
              <button 
                onClick={() => onOpenShared(pl.id)}
                className="w-full bg-gray-700 hover:bg-gray-600 py-2 rounded text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <ExternalLink className="w-4 h-4" /> 開啟檢視模式
              </button>
              <button 
                onClick={() => copyLink(pl.id)}
                className={`w-full border border-gray-600 py-2 rounded text-sm flex items-center justify-center gap-2 transition-colors ${justCopied === pl.id ? 'text-green-400 border-green-400' : 'text-gray-300 hover:bg-gray-700'}`}
              >
                {justCopied === pl.id ? <Check className="w-4 h-4"/> : <Share2 className="w-4 h-4"/>}
                {justCopied === pl.id ? '已複製連結' : '複製分享連結'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-xl w-full max-w-4xl p-6 border border-gray-700 max-h-[90vh] flex flex-col">
            <h2 className="text-xl font-bold mb-4">建立分享清單</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-400 mb-1">清單名稱</label>
              <input 
                type="text" 
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                placeholder="例如：精選動作片"
              />
            </div>

            <div className="flex-1 overflow-y-auto mb-4 border border-gray-700 rounded bg-gray-900/50 p-4">
               <h3 className="text-sm text-gray-400 mb-2">勾選要加入的影片：</h3>
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {videos.map(v => (
                    <div 
                      key={v.id} 
                      onClick={() => toggleSelect(v.id)}
                      className={`cursor-pointer p-2 rounded border flex items-center gap-3 ${selectedVideoIds.includes(v.id) ? 'border-blue-500 bg-blue-900/20' : 'border-gray-700 hover:bg-gray-800'}`}
                    >
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${selectedVideoIds.includes(v.id) ? 'bg-blue-600 border-blue-600' : 'border-gray-500'}`}>
                        {selectedVideoIds.includes(v.id) && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="truncate">
                        <div className="text-sm font-medium truncate">{v.title}</div>
                        <div className="text-xs text-gray-500 truncate">{v.tags?.join(', ')}</div>
                      </div>
                    </div>
                  ))}
               </div>
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-gray-400 hover:text-white">取消</button>
              <button 
                onClick={handleCreate} 
                disabled={!newTitle || selectedVideoIds.length === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded disabled:opacity-50"
              >
                建立並儲存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};