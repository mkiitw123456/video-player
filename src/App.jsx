import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, onSnapshot, 
  query, orderBy, deleteDoc, doc, getDoc, updateDoc 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, 
  signInWithCustomToken 
} from 'firebase/auth';
import { 
  Play, Pause, Volume2, Maximize, LogOut, Upload, 
  Search, Plus, X, List, Share2, Film, Lock, Image as ImageIcon,
  ExternalLink, ChevronRight, Check, Youtube, Trash2, Pencil
} from 'lucide-react';

// --- 設定區域 ---
const firebaseConfig = {
  apiKey: "AIzaSyAYhJ0BeSwR0i-x9HHAVXR2p_1dD0l-an4",
  authDomain: "video-faa49.firebaseapp.com",
  projectId: "video-faa49",
  storageBucket: "video-faa49.firebasestorage.app",
  messagingSenderId: "648988955584",
  appId: "1:648988955584:web:47ffd523c7f73a51f02e25",
  measurementId: "G-LTCZEXHP3B"
};

const configToUse = (typeof __firebase_config !== 'undefined') 
  ? JSON.parse(__firebase_config) 
  : firebaseConfig;

const app = initializeApp(configToUse);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'video-app';

const ADMIN_USER = "admin";
const ADMIN_PASS = "password123";

// --- Helper Functions ---

const getYouTubeID = (url) => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

const getYouTubeThumbnail = (id) => {
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
};

// --- Components ---

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
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-4">
      <div className="bg-gray-800 p-6 md:p-8 rounded-lg shadow-xl w-full max-w-sm border border-gray-700">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center">
            <Youtube className="w-8 h-8 text-white" />
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
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-red-500 text-base"
              placeholder="輸入 admin"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">密碼</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-red-500 text-base"
              placeholder="輸入 password123"
            />
          </div>
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button 
            type="submit" 
            className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded font-semibold transition-colors text-base"
          >
            登入系統
          </button>
        </form>
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [videos, setVideos] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [activeTab, setActiveTab] = useState('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState(null);
  
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [videoToEdit, setVideoToEdit] = useState(null);
  const [currentVideo, setCurrentVideo] = useState(null);
  const [sharedPlaylistId, setSharedPlaylistId] = useState(null);
  const [sharedPlaylistData, setSharedPlaylistData] = useState(null);

  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        try {
          await signInWithCustomToken(auth, __initial_auth_token);
        } catch (e) {
          await signInAnonymously(auth);
        }
      } else {
        try {
          await signInAnonymously(auth);
        } catch (e) {
          console.error("登入失敗:", e);
        }
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    
    const savedLogin = localStorage.getItem('app_is_admin');
    if (savedLogin === 'true') setIsAdmin(true);
    
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

  useEffect(() => {
    if (!user) return;

    const videosRef = collection(db, 'artifacts', appId, 'public', 'data', 'videos');
    const qVideos = query(videosRef, orderBy('createdAt', 'desc'));
    
    const unsubVideos = onSnapshot(qVideos, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setVideos(data);
    }, (err) => {
        if (err.code === 'permission-denied') {
            alert("讀取失敗：權限不足。請檢查 Firebase Console 設定。");
        }
    });

    const playlistsRef = collection(db, 'artifacts', appId, 'public', 'data', 'playlists');
    const qPlaylists = query(playlistsRef, orderBy('createdAt', 'desc'));
    const unsubPlaylists = onSnapshot(qPlaylists, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPlaylists(data);
    });

    return () => {
      unsubVideos();
      unsubPlaylists();
    };
  }, [user]);

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
          console.error(e);
        }
      };
      fetchPlaylist();
    }
  }, [sharedPlaylistId, user]);

  const handleAdminLogin = () => {
    setIsAdmin(true);
    localStorage.setItem('app_is_admin', 'true');
    if (activeTab === 'shared') setActiveTab('home');
  };

  const handleLogout = () => {
    setIsAdmin(false);
    localStorage.removeItem('app_is_admin');
    setActiveTab('home');
  };

  const handleDeleteVideo = async (e, videoId) => {
    e.stopPropagation();
    if (!confirm('確定要刪除這部影片嗎？此動作無法復原。')) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'videos', videoId));
    } catch (error) {
      alert("刪除失敗，請檢查權限。");
    }
  };

  const handleEditVideo = (e, video) => {
    e.stopPropagation();
    setVideoToEdit(video);
    setShowUploadModal(true);
  };

  const allTags = useMemo(() => {
    const tags = new Set();
    videos.forEach(v => v.tags?.forEach(t => tags.add(t)));
    return Array.from(tags);
  }, [videos]);

  const filteredVideos = useMemo(() => {
    let source = videos;
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
  
  if (!user) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white p-4">正在連線至資料庫...</div>;

  if (!isAdmin && activeTab !== 'shared') {
    return <LoginScreen onLogin={handleAdminLogin} />;
  }

  const isSharedMode = activeTab === 'shared';

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans pb-10">
      {/* 導覽列：響應式設計 */}
      <nav className="bg-gray-800 border-b border-gray-700 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo 區域：在手機上可能需要彈性縮小 */}
            <div className="flex items-center gap-2 cursor-pointer flex-shrink-0 mr-4" onClick={() => {
                if (!isSharedMode) {
                  setActiveTab('home');
                  setSharedPlaylistId(null);
                  setSearchQuery('');
                  setSelectedTag(null);
                  window.location.hash = ''; 
                }
              }}>
              <div className="bg-red-600 p-1.5 rounded-lg">
                <Film className="w-6 h-6 text-white" />
              </div>
              <span className="font-bold text-lg md:text-xl tracking-tight hidden xs:block">
                {isSharedMode ? (sharedPlaylistData?.title || '播放清單') : '影音平台'}
              </span>
              <span className="font-bold text-lg tracking-tight xs:hidden">
                {isSharedMode ? '清單' : '首頁'}
              </span>
            </div>

            {/* 電腦版中間搜尋列 (分享模式隱藏) */}
            {!isSharedMode && (
              <div className="flex-1 max-w-md mx-4 hidden md:block">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    className="block w-full pl-10 pr-3 py-2 border border-gray-600 rounded-full leading-5 bg-gray-700 text-gray-300 placeholder-gray-400 focus:outline-none focus:bg-gray-600 focus:border-red-500 transition duration-150 ease-in-out sm:text-sm"
                    placeholder="搜尋影片..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* 右側按鈕區：手機版改為橫向捲動，避免擠壓 */}
            {!isSharedMode && (
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-2 -mr-4 pr-4 md:mr-0 md:pr-0 md:overflow-visible">
                <button 
                  onClick={() => setActiveTab('home')}
                  className={`px-3 py-1.5 md:py-2 rounded-md text-sm font-medium whitespace-nowrap flex-shrink-0 ${activeTab === 'home' ? 'bg-gray-900 text-white' : 'text-gray-300 hover:text-white hover:bg-gray-700'}`}
                >
                  影片庫
                </button>
                <button 
                  onClick={() => setActiveTab('playlists')}
                  className={`px-3 py-1.5 md:py-2 rounded-md text-sm font-medium whitespace-nowrap flex-shrink-0 ${activeTab === 'playlists' ? 'bg-gray-900 text-white' : 'text-gray-300 hover:text-white hover:bg-gray-700'}`}
                >
                  播放清單
                </button>
                <button 
                  onClick={() => { setVideoToEdit(null); setShowUploadModal(true); }}
                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 md:px-4 md:py-2 rounded-full text-sm font-medium flex items-center gap-2 transition-colors whitespace-nowrap flex-shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">新增影片</span>
                  <span className="sm:hidden">新增</span>
                </button>
                <button onClick={handleLogout} className="text-gray-400 hover:text-red-400 ml-1 p-1 flex-shrink-0" title="登出">
                  <LogOut className="w-5 h-5 md:w-6 md:h-6" />
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* 手機版搜尋列 (分享模式隱藏) */}
        {!isSharedMode && (
          <div className="md:hidden mb-6">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                 <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-4 py-2 border border-gray-600 rounded-lg bg-gray-700 text-white focus:outline-none focus:border-red-500"
                placeholder="搜尋影片..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        )}

        {activeTab === 'playlists' && !isSharedMode && (
          <PlaylistManager 
            videos={videos} 
            playlists={playlists} 
            appId={appId}
          />
        )}

        {(activeTab === 'home' || activeTab === 'shared') && (
          <>
            {/* 標籤過濾器 (分享模式隱藏) */}
            {!isSharedMode && allTags.length > 0 && (
              <div className="mb-6 overflow-x-auto no-scrollbar pb-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedTag(null)}
                    className={`px-3 py-1 rounded-full text-sm transition-colors whitespace-nowrap ${!selectedTag ? 'bg-white text-gray-900' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                  >
                    全部
                  </button>
                  {allTags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                      className={`px-3 py-1 rounded-full text-sm transition-colors whitespace-nowrap ${tag === selectedTag ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {filteredVideos.length === 0 ? (
              <div className="text-center py-20 text-gray-500">沒有找到影片</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredVideos.map(video => (
                  <VideoCard 
                    key={video.id} 
                    video={video} 
                    onClick={() => setCurrentVideo(video)} 
                    isAdmin={isAdmin && !isSharedMode}
                    onDelete={handleDeleteVideo}
                    onEdit={handleEditVideo}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* RWD Modals */}
      {showUploadModal && (
        <UploadModal 
          onClose={() => { setShowUploadModal(false); setVideoToEdit(null); }} 
          appId={appId}
          existingTags={allTags}
          videoToEdit={videoToEdit}
        />
      )}

      {currentVideo && (
        <PlayerModal 
          video={currentVideo} 
          onClose={() => setCurrentVideo(null)} 
        />
      )}
    </div>
  );
}

const VideoCard = ({ video, onClick, isAdmin, onDelete, onEdit }) => {
  const isYoutube = getYouTubeID(video.url);
  
  return (
    <div 
      className="bg-gray-800 rounded-lg overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 group cursor-pointer border border-gray-700 flex flex-col h-full relative"
      onClick={onClick}
    >
      {/* 管理按鈕：
         在手機上 (md:hidden) 直接顯示 opacity-100，方便操作
         在電腦上 (hidden md:flex) 預設 opacity-0，hover 才顯示
      */}
      {isAdmin && (
        <div className="absolute top-2 left-2 z-20 flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-200">
          <button
            onClick={(e) => onEdit(e, video)}
            className="bg-gray-900/90 md:bg-gray-900/80 hover:bg-blue-600 text-white p-2 rounded-full shadow-md"
            title="編輯影片"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => onDelete(e, video.id)}
            className="bg-gray-900/90 md:bg-gray-900/80 hover:bg-red-600 text-white p-2 rounded-full shadow-md"
            title="刪除影片"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="relative aspect-video bg-black overflow-hidden">
        <img 
          src={video.thumbUrl || "https://placehold.co/600x400/000000/FFF?text=No+Thumbnail"} 
          alt={video.title} 
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80 group-hover:opacity-100"
        />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-red-600 p-3 rounded-full shadow-lg">
            <Play className="w-8 h-8 text-white fill-current pl-1" />
          </div>
        </div>
        {isYoutube && (
           <div className="absolute top-2 right-2 bg-red-600 text-white text-xs px-2 py-1 rounded flex items-center gap-1 shadow-sm">
             <Youtube className="w-3 h-3" /> <span className="hidden xs:inline">YouTube</span>
           </div>
        )}
      </div>
      <div className="p-4 flex flex-col flex-1">
        <h3 className="text-lg font-semibold text-white line-clamp-2 mb-1 group-hover:text-red-400 transition-colors">
          {video.title}
        </h3>
        <div className="flex flex-wrap gap-1 mb-2">
          {video.tags?.map(tag => (
            <span key={tag} className="text-xs text-blue-300 bg-blue-900/30 px-1.5 py-0.5 rounded">#{tag}</span>
          ))}
        </div>
      </div>
    </div>
  );
};

const PlayerModal = ({ video, onClose }) => {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const youtubeID = getYouTubeID(video.url);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const handleVolumeChange = (e) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    if (videoRef.current) videoRef.current.volume = vol;
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      setDuration(videoRef.current.duration || 0);
    }
  };

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
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-0 md:p-4">
      {/* 手機版全螢幕，電腦版維持卡片 */}
      <div className="w-full h-full md:h-auto md:max-h-[95vh] max-w-5xl bg-gray-900 md:rounded-xl overflow-hidden shadow-2xl flex flex-col">
        <div className="flex justify-between items-center p-3 border-b border-gray-800 shrink-0">
          <h2 className="text-lg font-bold text-white truncate pr-4">{video.title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 播放器區域：確保長寬比 */}
        <div className="relative bg-black flex-shrink-0 w-full aspect-video flex items-center justify-center group">
          {youtubeID ? (
            <iframe
              width="100%"
              height="100%"
              src={`https://www.youtube.com/embed/${youtubeID}?autoplay=1`}
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            ></iframe>
          ) : (
            <>
              <video
                ref={videoRef}
                src={video.url}
                className="w-full h-full"
                onTimeUpdate={handleTimeUpdate}
                onEnded={() => setIsPlaying(false)}
                onClick={togglePlay}
              >
                您的瀏覽器不支援影片播放。
              </video>
               {!isPlaying && (
                 <div className="absolute inset-0 flex items-center justify-center cursor-pointer bg-black/10" onClick={togglePlay}>
                    <div className="bg-white/20 hover:bg-white/30 backdrop-blur-md p-4 md:p-6 rounded-full transition-all">
                       <Play className="w-10 h-10 md:w-12 md:h-12 text-white fill-current translate-x-1" />
                    </div>
                 </div>
              )}
            </>
          )}
        </div>

        {/* 原生播放器控制列 */}
        {!youtubeID && (
          <div className="p-3 bg-gray-800 shrink-0">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs text-gray-400 w-8 text-right">{formatTime(currentTime)}</span>
              <input 
                type="range" 
                min="0" 
                max={duration || 100} 
                value={currentTime} 
                onChange={handleSeek}
                className="flex-1 h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-xs text-gray-400 w-8">{formatTime(duration)}</span>
            </div>
            <div className="flex items-center justify-between">
              <button onClick={togglePlay} className="text-white hover:text-red-500 p-1">
                {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current" />}
              </button>
              <div className="flex items-center gap-2 group">
                <Volume2 className="w-5 h-5 text-gray-400" />
                <input 
                  type="range" min="0" max="1" step="0.1" 
                  value={volume} onChange={handleVolumeChange}
                  className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}
        
        {/* 說明區域：在手機上可以滾動 */}
        <div className="p-4 bg-gray-900 border-t border-gray-800 overflow-y-auto flex-1">
            <h4 className="text-sm font-semibold text-gray-300 mb-1">影片說明</h4>
            <p className="text-sm text-gray-400 whitespace-pre-wrap leading-relaxed">{video.description || "無描述"}</p>
        </div>
      </div>
    </div>
  );
};

const UploadModal = ({ onClose, appId, existingTags, videoToEdit }) => {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [thumbUrl, setThumbUrl] = useState('');
  const [tags, setTags] = useState([]);
  const [newTag, setNewTag] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (videoToEdit) {
      setTitle(videoToEdit.title || '');
      setDesc(videoToEdit.description || '');
      setVideoUrl(videoToEdit.url || '');
      setThumbUrl(videoToEdit.thumbUrl || '');
      setTags(videoToEdit.tags || []);
    }
  }, [videoToEdit]);

  const handleUrlBlur = () => {
    const ytId = getYouTubeID(videoUrl);
    if (ytId && !thumbUrl) {
      setThumbUrl(getYouTubeThumbnail(ytId));
    }
  };

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
      if (file.size > 500000) { 
        alert("縮圖太大，請使用小於 500KB 的圖片");
        return;
      }
      const base64 = await fileToBase64(file);
      setThumbUrl(base64);
    }
  };

  const handleAddTag = (tagToAdd) => {
    const tag = tagToAdd || newTag;
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setNewTag('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (videoToEdit) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'videos', videoToEdit.id), {
          title,
          description: desc,
          url: videoUrl,
          thumbUrl,
          tags,
          updatedAt: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'videos'), {
          title,
          description: desc,
          url: videoUrl,
          thumbUrl,
          tags,
          createdAt: new Date().toISOString()
        });
      }
      onClose();
    } catch (error) {
      console.error(error);
      alert((videoToEdit ? "更新" : "上傳") + "失敗：" + error.message);
    } finally {
      setLoading(false);
    }
  };

  const availableTags = existingTags.filter(t => !tags.includes(t));

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-0 md:p-4">
      <div className="bg-gray-800 md:rounded-xl w-full h-full md:h-auto md:max-h-[90vh] md:max-w-2xl p-4 md:p-6 border border-gray-700 shadow-2xl overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            {videoToEdit ? <Pencil className="w-5 h-5 text-blue-500" /> : <Plus className="w-5 h-5 text-red-500" />} 
            {videoToEdit ? '編輯影片' : '新增影片'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-2">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 pb-10 md:pb-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">影片 URL</label>
                <input 
                  required
                  type="url" 
                  placeholder="https://youtu.be/..."
                  value={videoUrl}
                  onChange={e => setVideoUrl(e.target.value)}
                  onBlur={handleUrlBlur}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-red-500 text-base"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">標題</label>
                <input 
                  required
                  type="text" 
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-red-500 text-base"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">說明</label>
                <textarea 
                  rows="4"
                  value={desc}
                  onChange={e => setDesc(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-red-500 text-base"
                ></textarea>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">封面圖</label>
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-600 border-dashed rounded-lg cursor-pointer bg-gray-700 hover:bg-gray-600 relative overflow-hidden">
                    {thumbUrl ? (
                      <img src={thumbUrl} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <ImageIcon className="w-8 h-8 text-gray-400 mb-2" />
                        <p className="text-sm text-gray-400">點擊上傳 / 自動抓取</p>
                      </div>
                    )}
                    <input type="file" className="hidden" accept="image/png, image/jpeg" onChange={handleThumbUpload} />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">標籤</label>
                <div className="flex gap-2 mb-2">
                  <input 
                    type="text" 
                    value={newTag}
                    onChange={e => setNewTag(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), () => handleAddTag())}
                    placeholder="輸入後按 Enter"
                    className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-red-500 text-base"
                  />
                  <button 
                    type="button" 
                    onClick={() => handleAddTag()}
                    className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-2 rounded"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="flex flex-wrap gap-2 min-h-[40px] bg-gray-900/50 p-2 rounded border border-gray-700 mb-2">
                  {tags.map(tag => (
                    <span key={tag} className="bg-red-600 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                      {tag}
                      <button type="button" onClick={() => setTags(tags.filter(t => t !== tag))} className="hover:text-red-200 p-1">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {tags.length === 0 && <span className="text-gray-500 text-sm italic">尚無標籤</span>}
                </div>

                {availableTags.length > 0 && (
                  <div className="text-xs">
                    <p className="text-gray-400 mb-1">現有標籤：</p>
                    <div className="flex flex-wrap gap-2">
                      {availableTags.map(tag => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => handleAddTag(tag)}
                          className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-1.5 rounded-full transition-colors"
                        >
                          + {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-700">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white mr-4 text-base">取消</button>
            <button 
              type="submit" 
              disabled={loading || !videoUrl || !title}
              className={`px-6 py-2 rounded font-medium text-white text-base ${loading ? 'opacity-50 cursor-not-allowed' : (videoToEdit ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700')}`}
            >
              {loading ? '處理中...' : (videoToEdit ? '儲存變更' : '確認新增')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const PlaylistManager = ({ videos, playlists, appId }) => {
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
    const link = `${window.location.origin}${window.location.pathname}#playlist/${id}`;
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
        <h2 className="text-xl md:text-2xl font-bold">我的播放清單</h2>
        <button 
          onClick={() => setShowCreate(true)} 
          className="bg-green-600 hover:bg-green-700 px-3 py-2 md:px-4 rounded flex items-center gap-2 text-sm md:text-base transition-colors"
        >
          <Plus className="w-4 h-4" /> 建立新清單
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {playlists.map(pl => (
          <div key={pl.id} className="bg-gray-800 rounded-lg p-5 md:p-6 border border-gray-700 flex flex-col shadow-lg">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg md:text-xl font-bold truncate flex-1 pr-2">{pl.title}</h3>
              <div className="flex gap-2">
                 <button 
                  onClick={() => deletePlaylist(pl.id)} 
                  className="text-gray-500 hover:text-red-500 p-1"
                  title="刪除"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <p className="text-gray-400 text-sm mb-4">
              包含 {pl.videoIds?.length || 0} 部影片
            </p>

            <div className="mt-auto">
              <button 
                onClick={() => copyLink(pl.id)}
                className={`w-full py-2.5 md:py-2 rounded text-sm flex items-center justify-center gap-2 transition-colors font-medium ${justCopied === pl.id ? 'bg-green-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-200'}`}
              >
                {justCopied === pl.id ? <Check className="w-4 h-4"/> : <Share2 className="w-4 h-4"/>}
                {justCopied === pl.id ? '已複製連結' : '複製分享連結'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-0 md:p-4">
          <div className="bg-gray-800 md:rounded-xl w-full h-full md:h-auto md:max-w-4xl p-4 md:p-6 border border-gray-700 max-h-[90vh] flex flex-col">
            <h2 className="text-xl font-bold mb-4 shrink-0">建立分享清單</h2>
            
            <div className="mb-4 shrink-0">
              <label className="block text-sm font-medium text-gray-400 mb-1">清單名稱</label>
              <input 
                type="text" 
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-base"
                placeholder="例如：精選動作片"
              />
            </div>

            <div className="flex-1 overflow-y-auto mb-4 border border-gray-700 rounded bg-gray-900/50 p-4 min-h-0">
               <h3 className="text-sm text-gray-400 mb-3">勾選要加入的影片：</h3>
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {videos.map(v => (
                    <div 
                      key={v.id} 
                      onClick={() => toggleSelect(v.id)}
                      className={`cursor-pointer p-3 rounded border flex items-center gap-3 transition-colors ${selectedVideoIds.includes(v.id) ? 'border-blue-500 bg-blue-900/20' : 'border-gray-700 hover:bg-gray-800'}`}
                    >
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 ${selectedVideoIds.includes(v.id) ? 'bg-blue-600 border-blue-600' : 'border-gray-500'}`}>
                        {selectedVideoIds.includes(v.id) && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="truncate flex-1">
                        <div className="text-sm font-medium truncate">{v.title}</div>
                        <div className="text-xs text-gray-500 truncate">{v.tags?.join(', ')}</div>
                      </div>
                    </div>
                  ))}
               </div>
            </div>

            <div className="flex justify-end gap-3 shrink-0 pb-6 md:pb-0">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-gray-400 hover:text-white text-base">取消</button>
              <button 
                onClick={handleCreate} 
                disabled={!newTitle || selectedVideoIds.length === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded disabled:opacity-50 text-base font-medium"
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