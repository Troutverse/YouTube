'use client';

import React, { useState, useEffect } from 'react';
import { Youtube, User, Eye, ThumbsUp, BarChart2, Hash, Clock, Trophy, LineChart, Search, Calendar, X, ExternalLink } from 'lucide-react';

// --- 타입 정의 ---
interface ApiResponse {
  videos: Video[];
  analysis: AnalysisData;
}

interface Video {
  video_id: string;
  title: string;
  channel: string;
  channel_url: string;
  view_count: number;
  like_count: number;
  published_at: string;
  like_to_view_ratio: number;
}

interface AnalysisData {
  keyword_analysis: [string, number][];
  title_length_analysis: { average_title_length: number };
  channel_analysis: {
    top_channels_by_video_count: { channel: string; video_count: number }[];
    top_channels_by_avg_views: { channel: string; average_views: number; video_count: number }[];
  };
  time_analysis: {
    upload_hour_distribution: Record<string, number>;
    upload_day_distribution: Record<string, number>;
  };
}

// --- 상수 정의 (확장됨) ---
const CATEGORIES = [
  '인기', '뉴스', '정치', '경제', 'IT', '기술', '과학', '게임', '음악', '영화', 
  '애니메이션', '코미디', '엔터테인먼트', '브이로그', '일상', '뷰티', '패션', 
  '요리', '음식', '여행', '스포츠', '축구', '야구', '반려동물', '동물', 
  '교육', '지식', '노하우', '스타일', '키즈', '자동차', '부동산', '건강', '운동'
];
const PERIODS = [
  { key: 'all', label: '전체 기간' },
  { key: '1week', label: '최근 1주' },
  { key: '1month', label: '최근 1달' },
  { key: '1year', label: '최근 1년' },
  { key: '2year', label: '최근 2년' },
  { key: '3year', label: '최근 3년' },
  { key: '4year', label: '최근 4년' },
  { key: '5year', label: '최근 5년' },
];

// --- 헬퍼 함수 ---
const formatNumber = (num: number): string => {
  if (num >= 10000) return (num / 10000).toFixed(1).replace(/\.0$/, '') + '만';
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + '천';
  return num.toString();
};

// --- 모달 컴포넌트 ---
const Modal = ({ isOpen, onClose, title, children }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-gray-800 rounded-xl shadow-lg w-full max-w-md max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b border-gray-700">
                    <h2 className="text-xl font-bold text-white">{title}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors"><X size={24} /></button>
                </div>
                <div className="p-6 overflow-y-auto">{children}</div>
            </div>
        </div>
    );
};

// --- 메인 컴포넌트 ---
export default function Home() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 카테고리 상태를 문자열 배열로 변경
  const [selectedCategories, setSelectedCategories] = useState(['인기']);
  const [period, setPeriod] = useState('all');
  const [modalContent, setModalContent] = useState<{ title: string; content: React.ReactNode } | null>(null);

  // 카테고리 클릭 핸들러 (다중 선택 로직)
  const handleCategoryClick = (category: string) => {
    setSelectedCategories(prev => {
      const isSelected = prev.includes(category);
      if (isSelected) {
        // 선택된 카테고리가 1개뿐이면 제거하지 않음
        if (prev.length === 1) return prev;
        return prev.filter(c => c !== category);
      } else {
        // '인기'가 선택된 상태에서 다른 카테고리를 누르면 '인기'를 제거
        if (prev.includes('인기')) {
            return [category];
        }
        return [...prev, category];
      }
    });
  };

  useEffect(() => {
    const fetchAnalysisData = async () => {
      setLoading(true);
      setError(null);
      // 선택된 카테고리 배열을 콤마로 연결된 문자열로 변환
      const categoryQuery = selectedCategories.join(',');
      try {
        const response = await fetch(`http://localhost:5001/api/videos?category=${categoryQuery}&period=${period}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const result: ApiResponse = await response.json();
        setData(result);
      } catch (e) {
        console.error("Failed to fetch data:", e);
        setError('데이터를 불러오는 데 실패했습니다. API 서버가 실행 중인지 확인해주세요.');
      } finally {
        setLoading(false);
      }
    };
    fetchAnalysisData();
  }, [selectedCategories, period]);

  const openModal = (title: string, content: React.ReactNode) => setModalContent({ title, content });
  const closeModal = () => setModalContent(null);

  // --- UI 렌더링 부분 ---
  if (loading) {
    return (
      <main className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="flex flex-col items-center gap-4">
          <Youtube className="w-16 h-16 animate-pulse text-red-500" />
          <p className="text-xl text-center">'{selectedCategories.join(', ')}' 쇼츠 트렌드를<br/>분석하고 있습니다...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (<main className="flex items-center justify-center min-h-screen bg-gray-900 text-red-400"><p className="text-xl">{error}</p></main>);
  }

  const { videos, analysis } = data || { videos: [], analysis: null };
  
  const AnalysisCard = ({ title, icon, data, renderItem, limit = 5 }: { title: string; icon: React.ReactNode; data: any[]; renderItem: (item: any, index: number) => React.ReactNode; limit?: number }) => {
    if (!data || data.length === 0) return null;
    const hasMore = data.length > limit;
    const ListComponent = title.includes("키워드") ? "ol" : "ul";
    const fullContent = <ListComponent className={`${ListComponent === "ol" ? 'list-decimal list-inside' : ''} space-y-2 text-gray-300`}>{data.map((item, index) => <li key={index}>{renderItem(item, index)}</li>)}</ListComponent>;
    return (
      <div className="bg-gray-800 p-6 rounded-xl shadow-lg flex flex-col">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">{icon}{title}</h3>
        <div className="flex-grow">{React.cloneElement(fullContent, { children: data.slice(0, limit).map((item, index) => <li key={index}>{renderItem(item, index)}</li>) })}</div>
        {hasMore && <button onClick={() => openModal(title, fullContent)} className="mt-4 text-sm font-semibold text-sky-400 hover:text-sky-300 self-start flex items-center gap-1">더보기 <ExternalLink size={14}/></button>}
      </div>
    );
  };

  const AnalysisDashboard = () => (
    analysis && (
      <div className="mb-12">
        <h2 className="text-3xl font-bold text-center mb-6 flex items-center justify-center gap-3"><BarChart2 className="w-8 h-8 text-indigo-400"/>쇼츠 트렌드 분석 대시보드</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnalysisCard title="인기 키워드 TOP 10" icon={<Hash className="text-sky-400"/>} data={analysis.keyword_analysis} renderItem={([word, count]) => <><span className="font-medium text-white">{word}</span> ({count}회)</>} />
            <AnalysisCard title="최다 쇼츠 등록 채널" icon={<Trophy className="text-amber-400"/>} data={analysis.channel_analysis.top_channels_by_video_count} renderItem={(c, i) => <><span className="font-bold text-white">{i + 1}. {c.channel}</span> ({c.video_count}개)</>} />
            <AnalysisCard title="평균 조회수 TOP 채널" icon={<LineChart className="text-emerald-400"/>} data={analysis.channel_analysis.top_channels_by_avg_views} renderItem={(c, i) => <><span className="font-bold text-white">{i + 1}. {c.channel}</span> (평균 {formatNumber(c.average_views)}회)</>} />
            <AnalysisCard title="인기 업로드 요일" icon={<Clock className="text-violet-400"/>} data={Object.entries(analysis.time_analysis.upload_day_distribution)} renderItem={([day, count]) => <>{day}: {count}개</>} />
            <AnalysisCard title="인기 업로드 시간대" icon={<Clock className="text-rose-400"/>} data={Object.entries(analysis.time_analysis.upload_hour_distribution)} renderItem={([hour, count]) => <>{hour}시: {count}개</>} />
            <div className="bg-gray-800 p-6 rounded-xl shadow-lg flex flex-col items-center justify-center"><h3 className="font-bold text-lg mb-2">평균 제목 길이</h3><p className="text-4xl font-bold text-teal-400">{analysis.title_length_analysis.average_title_length}자</p></div>
        </div>
      </div>
    )
  );
  
  return (
    <main className="min-h-screen bg-gray-900 text-white p-4 sm:p-8">
      <Modal isOpen={!!modalContent} onClose={closeModal} title={modalContent?.title || ''}>{modalContent?.content}</Modal>
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 text-center"><h1 className="text-4xl sm:text-5xl font-bold tracking-tight flex items-center justify-center gap-3"><Youtube className="w-10 h-10 text-red-600" /><span>쇼츠 트렌드 분석기</span></h1></header>
        <div className="mb-10 p-6 bg-gray-800/50 rounded-xl">
            <div className="mb-6">
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-3"><Search className="w-5 h-5 text-sky-400"/>카테고리 선택 (다중 선택 가능)</h3>
                <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map(c => {
                        const isSelected = selectedCategories.includes(c);
                        return (<button key={c} onClick={() => handleCategoryClick(c)} className={`px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 ${isSelected ? 'bg-sky-500 text-white shadow-lg scale-105' : 'bg-gray-700 hover:bg-gray-600'}`}>{c}</button>);
                    })}
                </div>
            </div>
            <div>
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-3"><Calendar className="w-5 h-5 text-emerald-400"/>기간 선택</h3>
                <div className="flex flex-wrap gap-2">
                    {PERIODS.map(p => (<button key={p.key} onClick={() => setPeriod(p.key)} className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${period === p.key ? 'bg-emerald-500 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}>{p.label}</button>))}
                </div>
            </div>
        </div>
        {videos.length > 0 ? (
          <>
            <AnalysisDashboard />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {videos.map((video) => (
                <div key={video.video_id} className="bg-gray-800 rounded-xl overflow-hidden shadow-lg flex flex-col transition-transform duration-300 hover:scale-105 hover:shadow-red-500/20">
                  <div className="aspect-[9/16] w-full"><iframe className="w-full h-full" src={`https://www.youtube.com/embed/${video.video_id}`} title={video.title} frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe></div>
                  <div className="p-4 flex flex-col flex-grow">
                    <h3 className="font-semibold text-base text-gray-100 mb-2 leading-snug flex-grow" title={video.title}>{video.title.length > 50 ? `${video.title.substring(0, 50)}...` : video.title}</h3>
                    <div className="mt-auto space-y-2 text-sm text-gray-400">
                      <a href={video.channel_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-red-400 transition-colors duration-200"><User className="w-4 h-4" /><span className="truncate">{video.channel}</span></a>
                      <div className="flex items-center gap-2"><Eye className="w-4 h-4" /><span>조회수 {formatNumber(video.view_count)}회</span></div>
                      <div className="flex items-center gap-2 text-emerald-400"><ThumbsUp className="w-4 h-4" /><span>시청자 반응: {video.like_to_view_ratio}%</span></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (<div className="text-center py-10"><p className="text-xl text-gray-400">'{selectedCategories.join(', ')}' 카테고리에서 해당 기간의 쇼츠를 찾을 수 없습니다.</p></div>)}
      </div>
    </main>
  );
}
