'use client';

import React, { useState, useEffect } from 'react';
import { Youtube, User, Eye, ThumbsUp, BarChart2, Hash, Clock, Trophy, LineChart, Search, Calendar, X, ExternalLink, Smile, Frown, Meh, Zap, Type, Link2, Tv2, Loader2, List, Grid, Globe } from 'lucide-react';

// --- 타입 정의 ---
interface ApiResponse {
  videos: Video[];
  analysis: AnalysisData;
}

interface Video {
  video_id: string;
  title: string;
  channel: string;
  channel_id: string;
  channel_url: string;
  view_count: number;
  like_count: number;
  published_at: string;
  like_to_view_ratio: number;
  description?: string;
}

interface AnalysisData {
  keyword_analysis: [string, number][];
  title_length_analysis: { average_title_length: number };
  channel_analysis: {
    top_channels_by_video_count: [string, number][];
    top_channels_by_avg_views: { channel: string; average_views: number; video_count: number }[];
  };
  time_analysis: {
    upload_hour_distribution: Record<string, number>;
    upload_day_distribution: Record<string, number>;
  };
  sentiment_analysis: { positive: number; negative: number; neutral: number; };
  breakout_videos: Video[];
  title_pattern_analysis: { question: number; list_format: number; urgent_format: number; };
  correlation_analysis: { title_length_vs_views: number; like_ratio_vs_views: number; };
}

// --- 상수 정의 ---
const CATEGORIES = [
  '인기', '뉴스', '정치', '경제', 'IT', '기술', '과학', '게임', '음악', '영화', '애니메이션', '코미디', '엔터테인먼트', '브이로그', '일상', '뷰티', '패션', '요리', '음식', '여행', '스포츠', '축구', '야구', '반려동물', '동물', '교육', '지식', '노하우', '스타일', '키즈', '자동차', '부동산', '건강', '운동'
];
const PERIODS = [
  { key: 'today', label: '오늘' }, { key: '3days', label: '3일' }, { key: '5days', label: '5일' }, { key: '1week', label: '1주' }, { key: '1month', label: '1달' }, { key: '1year', label: '1년' }, { key: '2year', label: '2년' }, { key: '3year', label: '3년' }, { key: '4year', label: '4년' }, { key: '5year', label: '5년' }, { key: 'all', label: '전체' },
];
const COUNTRIES = [
    { key: 'KR', label: '한국' }, { key: 'US', label: '미국' }, { key: 'JP', label: '일본' }, { key: 'GB', label: '영국' }, { key: 'FR', label: '프랑스' }, { key: 'DE', label: '독일' }, { key: 'CA', label: '캐나다' }, { key: 'IN', label: '인도' }, { key: 'BR', label: '브라질' }, { key: 'RU', label: '러시아' },
];

// --- 헬퍼 함수 ---
const formatNumber = (num: number): string => {
  if (num >= 100000000) return (num / 100000000).toFixed(1).replace(/\.0$/, '') + '억';
  if (num >= 10000) return (num / 10000).toFixed(1).replace(/\.0$/, '') + '만';
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + '천';
  return num.toString();
};
const getCorrelationDescription = (value: number) => {
    if (value === null || isNaN(value)) return `(N/A) 분석 불가`;
    if (Math.abs(value) >= 0.7) return `(${value}) 매우 강한 관계`;
    if (Math.abs(value) >= 0.4) return `(${value}) 강한 관계`;
    if (Math.abs(value) >= 0.2) return `(${value}) 약한 관계`;
    return `(${value}) 거의 관계 없음`;
}

// --- 모달 컴포넌트 ---
const Modal = ({ isOpen, onClose, title, children, maxWidth = 'max-w-2xl' }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; maxWidth?: string }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className={`bg-gray-800 rounded-xl shadow-lg w-full ${maxWidth} max-h-[90vh] flex flex-col`} onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b border-gray-700">
                    <h2 className="text-xl font-bold text-white truncate">{title}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors flex-shrink-0"><X size={24} /></button>
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
  const [selectedCategories, setSelectedCategories] = useState(['인기']);
  const [selectedCountries, setSelectedCountries] = useState(['KR']);
  const [period, setPeriod] = useState('all');
  const [viewMode, setViewMode] = useState('video');
  
  const [modalContent, setModalContent] = useState<{ title: string; content: React.ReactNode } | null>(null);
  const [channelModalData, setChannelModalData] = useState<{ title: string; videos: Video[] } | null>(null);
  const [isChannelLoading, setIsChannelLoading] = useState(false);
  const [descriptionModal, setDescriptionModal] = useState<{ title: string, description: string } | null>(null);

  const handleCategoryClick = (category: string) => {
    setSelectedCategories(prev => {
      const isSelected = prev.includes(category);
      if (isSelected) {
        if (prev.length === 1) return prev;
        return prev.filter(c => c !== category);
      } else {
        if (prev.includes('인기')) return [category];
        return [...prev, category];
      }
    });
  };

  const handleCountryClick = (countryKey: string) => {
      setSelectedCountries(prev => {
          const isSelected = prev.includes(countryKey);
          if (isSelected) {
              if (prev.length === 1) return prev;
              return prev.filter(c => c !== countryKey);
          } else {
              return [...prev, countryKey];
          }
      });
  };

  const handleChannelAnalysis = async (channelId: string, channelName: string) => {
      setIsChannelLoading(true);
      setChannelModalData({ title: `${channelName} 채널 분석`, videos: [] });
      try {
          const response = await fetch(`http://localhost:5001/api/channel/${channelId}`);
          const channelVideos: Video[] = await response.json();
          const sortedVideos = channelVideos.sort((a, b) => b.view_count - a.view_count);
          setChannelModalData({ title: `${channelName} 채널의 영상 (조회수 순)`, videos: sortedVideos });
      } catch (err) {
          console.error("Failed to fetch channel videos:", err);
          setChannelModalData({ title: `Error`, videos: [] });
      } finally {
          setIsChannelLoading(false);
      }
  };

  useEffect(() => {
    const fetchAnalysisData = async () => {
      setLoading(true);
      setError(null);
      const categoryQuery = selectedCategories.join(',');
      const countryQuery = selectedCountries.join(',');
      try {
        const response = await fetch(`http://localhost:5001/api/videos?category=${categoryQuery}&period=${period}&countries=${countryQuery}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const result: ApiResponse = await response.json();
        
        // 데이터를 받은 후 프론트엔드에서 조회수 순으로 정렬합니다.
        if (result.videos) {
            result.videos.sort((a, b) => b.view_count - a.view_count);
        }

        setData(result);
      } catch (e) {
        console.error("Failed to fetch data:", e);
        setError('데이터를 불러오는 데 실패했습니다. API 서버가 실행 중인지 확인해주세요.');
      } finally {
        setLoading(false);
      }
    };
    fetchAnalysisData();
  }, [selectedCategories, period, selectedCountries]);

  const openModal = (title: string, content: React.ReactNode) => setModalContent({ title, content });
  const closeModal = () => setModalContent(null);

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

  if (error) return (<main className="flex items-center justify-center min-h-screen bg-gray-900 text-red-400"><p className="text-xl">{error}</p></main>);

  const { videos, analysis } = data || { videos: [], analysis: null };
  
  const AnalysisCard = ({ title, icon, data, renderItem, limit = 5 }: { title: string; icon: React.ReactNode; data: any[]; renderItem: (item: any, index: number) => React.ReactNode; limit?: number }) => {
    if (!data || data.length === 0) return null;
    const hasMore = data.length > limit;
    const ListComponent = title.includes("키워드") ? "ol" : "ul";
    const fullContent = <ListComponent className={`${ListComponent === "ol" ? 'list-decimal list-inside' : ''} space-y-2 text-gray-300`}>{data.map((item, index) => <li key={index}>{renderItem(item, index)}</li>)}</ListComponent>;
    return (
      <div className="bg-gray-800 p-6 rounded-xl shadow-lg flex flex-col">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">{icon}{title}</h3>
        <div className="flex-grow overflow-hidden">{React.cloneElement(fullContent, { children: data.slice(0, limit).map((item, index) => <li key={index}>{renderItem(item, index)}</li>) })}</div>
        {hasMore && <button onClick={() => openModal(title, fullContent)} className="mt-4 text-sm font-semibold text-sky-400 hover:text-sky-300 self-start flex items-center gap-1">더보기 <ExternalLink size={14}/></button>}
      </div>
    );
  };

  const AnalysisDashboard = () => (
    analysis && (
      <div className="mb-12">
        <h2 className="text-3xl font-bold text-center mb-6 flex items-center justify-center gap-3"><BarChart2 className="w-8 h-8 text-indigo-400"/>쇼츠 트렌드 분석 대시보드</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnalysisCard title="인기 키워드" icon={<Hash className="text-sky-400"/>} data={analysis.keyword_analysis} renderItem={([word, count]) => <><span className="font-medium text-white">{word}</span> ({count}회)</>} />
            <AnalysisCard title="최다 쇼츠 등록 채널" icon={<Trophy className="text-amber-400"/>} data={analysis.channel_analysis.top_channels_by_video_count} renderItem={([name, count], i) => <><span className="font-bold text-white">{i + 1}. {name}</span> ({count}개)</>} />
            <AnalysisCard title="평균 조회수 TOP 채널" icon={<LineChart className="text-emerald-400"/>} data={analysis.channel_analysis.top_channels_by_avg_views} renderItem={(c, i) => <><span className="font-bold text-white">{i + 1}. {c.channel}</span> (평균 {formatNumber(c.average_views)}회)</>} />
            <AnalysisCard title="'떡상'한 영상" icon={<Zap className="text-yellow-400"/>} data={analysis.breakout_videos} renderItem={(v) => <a href={`https://www.youtube.com/watch?v=${v.video_id}`} target="_blank" rel="noopener noreferrer" className="hover:text-white truncate block">{v.title} ({formatNumber(v.view_count)}회)</a>} />
            <div className="bg-gray-800 p-6 rounded-xl shadow-lg"><h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Smile className="text-green-400"/>제목 감성 분석</h3><ul className="space-y-2 text-gray-300"><li><span className="font-medium text-white">긍정적:</span> {analysis.sentiment_analysis.positive}개</li><li><span className="font-medium text-white">부정적:</span> {analysis.sentiment_analysis.negative}개</li><li><span className="font-medium text-white">중립적:</span> {analysis.sentiment_analysis.neutral}개</li></ul></div>
            <div className="bg-gray-800 p-6 rounded-xl shadow-lg"><h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Type className="text-orange-400"/>제목 패턴 분석</h3><ul className="space-y-2 text-gray-300"><li><span className="font-medium text-white">질문형 (?):</span> {analysis.title_pattern_analysis.question}개</li><li><span className="font-medium text-white">리스트형 (TOP N):</span> {analysis.title_pattern_analysis.list_format}개</li><li><span className="font-medium text-white">긴급/주목형:</span> {analysis.title_pattern_analysis.urgent_format}개</li></ul></div>
            <div className="bg-gray-800 p-6 rounded-xl shadow-lg"><h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Link2 className="text-cyan-400"/>상관관계 분석</h3><ul className="space-y-2 text-gray-300"><li>제목 길이 vs 조회수: <span className="font-medium text-white">{getCorrelationDescription(analysis.correlation_analysis.title_length_vs_views)}</span></li><li>반응도 vs 조회수: <span className="font-medium text-white">{getCorrelationDescription(analysis.correlation_analysis.like_ratio_vs_views)}</span></li></ul></div>
            <AnalysisCard title="인기 업로드 요일" icon={<Clock className="text-violet-400"/>} data={Object.entries(analysis.time_analysis.upload_day_distribution)} renderItem={([day, count]) => <>{day}: {count}개</>} />
            <AnalysisCard title="인기 업로드 시간대" icon={<Clock className="text-rose-400"/>} data={Object.entries(analysis.time_analysis.upload_hour_distribution)} renderItem={([hour, count]) => <>{hour}시: {count}개</>} />
            <div className="bg-gray-800 p-6 rounded-xl shadow-lg flex flex-col items-center justify-center"><h3 className="font-bold text-lg mb-2">평균 제목 길이</h3><p className="text-4xl font-bold text-teal-400">{analysis.title_length_analysis.average_title_length}자</p></div>
        </div>
      </div>
    )
  );

  const VideoCardView = () => (
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
              <button onClick={() => handleChannelAnalysis(video.channel_id, video.channel)} className="w-full mt-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-md text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors"><Tv2 size={14} />채널 분석</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const VideoTableView = () => (
    <div className="bg-gray-800/50 rounded-xl overflow-x-auto">
      <table className="w-full text-sm text-left text-gray-300">
        <thead className="text-xs text-gray-400 uppercase bg-gray-700/50">
          <tr>
            <th scope="col" className="px-6 py-3">채널</th>
            <th scope="col" className="px-6 py-3">제목</th>
            <th scope="col" className="px-6 py-3">조회수</th>
            <th scope="col" className="px-6 py-3">좋아요</th>
            <th scope="col" className="px-6 py-3">반응도 (%)</th>
            <th scope="col" className="px-6 py-3">업로드 날짜</th>
            <th scope="col" className="px-6 py-3">채널 분석</th>
          </tr>
        </thead>
        <tbody>
          {videos.map((video) => (
            <tr key={video.video_id} className="bg-gray-800 border-b border-gray-700 hover:bg-gray-700/50">
              <td className="px-6 py-4"><a href={video.channel_url} target="_blank" rel="noopener noreferrer" className="hover:text-sky-400 whitespace-nowrap">{video.channel}</a></td>
              <td className="px-6 py-4 font-medium text-white max-w-sm truncate" title={video.title}><a href={`https://www.youtube.com/watch?v=${video.video_id}`} target="_blank" rel="noopener noreferrer" className="hover:text-sky-400">{video.title}</a></td>
              <td className="px-6 py-4 whitespace-nowrap">{formatNumber(video.view_count)}</td>
              <td className="px-6 py-4 whitespace-nowrap">{formatNumber(video.like_count)}</td>
              <td className="px-6 py-4 whitespace-nowrap">{video.like_to_view_ratio}</td>
              <td className="px-6 py-4 whitespace-nowrap">{new Date(video.published_at).toLocaleDateString()}</td>
              <td className="px-6 py-4"><button onClick={() => handleChannelAnalysis(video.channel_id, video.channel)} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-md text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors"><Tv2 size={14} />분석</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  
  return (
    <main className="min-h-screen bg-gray-900 text-white p-4 sm:p-8">
      <Modal isOpen={!!modalContent} onClose={closeModal} title={modalContent?.title || ''}>{modalContent?.content}</Modal>
      <Modal isOpen={!!descriptionModal} onClose={() => setDescriptionModal(null)} title={descriptionModal?.title || '설명'} maxWidth="max-w-lg"><p className="text-gray-300 whitespace-pre-wrap">{descriptionModal?.description}</p></Modal>
      <Modal isOpen={!!channelModalData} onClose={() => setChannelModalData(null)} title={channelModalData?.title || '채널 분석'} maxWidth="max-w-5xl">
          {isChannelLoading ? (<div className="flex justify-center items-center h-40"><Loader2 className="animate-spin" size={40} /></div>) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-300">
                  <thead className="text-xs text-gray-400 uppercase bg-gray-900">
                    <tr><th scope="col" className="px-4 py-3">제목</th><th scope="col" className="px-4 py-3">조회수</th><th scope="col" className="px-4 py-3">좋아요</th><th scope="col" className="px-4 py-3">업로드 날짜</th><th scope="col" className="px-4 py-3">설명</th></tr>
                  </thead>
                  <tbody>
                    {channelModalData?.videos.map(v => (
                      <tr key={v.video_id} className="border-b border-gray-700 hover:bg-gray-700/50">
                        <td className="px-4 py-4 font-medium text-white max-w-xs truncate"><a href={`https://www.youtube.com/watch?v=${v.video_id}`} target="_blank" rel="noopener noreferrer" className="hover:text-sky-400" title={v.title}>{v.title}</a></td>
                        <td className="px-4 py-4 whitespace-nowrap">{formatNumber(v.view_count)}</td>
                        <td className="px-4 py-4 whitespace-nowrap">{formatNumber(v.like_count)}</td>
                        <td className="px-4 py-4 whitespace-nowrap">{new Date(v.published_at).toLocaleDateString()}</td>
                        <td className="px-4 py-4"><button onClick={() => setDescriptionModal({ title: v.title, description: v.description || "설명이 없습니다." })} className="text-xs text-sky-400 hover:underline">보기</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          )}
      </Modal>
      
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 text-center"><h1 className="text-4xl sm:text-5xl font-bold tracking-tight flex items-center justify-center gap-3"><Youtube className="w-10 h-10 text-red-600" /><span>쇼츠 트렌드 분석기</span></h1></header>
        
        <div className="mb-10 p-6 bg-gray-800/50 rounded-xl space-y-6">
            <div><h3 className="text-lg font-semibold flex items-center gap-2 mb-3"><Search className="w-5 h-5 text-sky-400"/>카테고리 선택</h3><div className="flex flex-wrap gap-2">{CATEGORIES.map(c => (<button key={c} onClick={() => handleCategoryClick(c)} className={`px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 ${selectedCategories.includes(c) ? 'bg-sky-500 text-white shadow-lg scale-105' : 'bg-gray-700 hover:bg-gray-600'}`}>{c}</button>))}</div></div>
            <div><h3 className="text-lg font-semibold flex items-center gap-2 mb-3"><Globe className="w-5 h-5 text-lime-400"/>국가 선택</h3><div className="flex flex-wrap gap-2">{COUNTRIES.map(c => (<button key={c.key} onClick={() => handleCountryClick(c.key)} className={`px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 ${selectedCountries.includes(c.key) ? 'bg-lime-500 text-white shadow-lg scale-105' : 'bg-gray-700 hover:bg-gray-600'}`}>{c.label}</button>))}</div></div>
            <div><h3 className="text-lg font-semibold flex items-center gap-2 mb-3"><Calendar className="w-5 h-5 text-emerald-400"/>기간 선택</h3><div className="flex flex-wrap gap-2">{PERIODS.map(p => (<button key={p.key} onClick={() => setPeriod(p.key)} className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${period === p.key ? 'bg-emerald-500 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}>{p.label}</button>))}</div></div>
        </div>

        {videos.length > 0 ? (
          <>
            <AnalysisDashboard />
            <div className="flex justify-between items-center my-8">
              <h2 className="text-3xl font-bold flex items-center gap-3"><Tv2 className="w-8 h-8 text-gray-400"/>영상 목록</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => setViewMode('video')} className={`p-2 rounded-md transition-colors ${viewMode === 'video' ? 'bg-sky-500 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}><Grid size={20}/></button>
                <button onClick={() => setViewMode('table')} className={`p-2 rounded-md transition-colors ${viewMode === 'table' ? 'bg-sky-500 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}><List size={20}/></button>
              </div>
            </div>
            {viewMode === 'video' ? <VideoCardView /> : <VideoTableView />}
          </>
        ) : (<div className="text-center py-10"><p className="text-xl text-gray-400">선택하신 조건의 쇼츠를 찾을 수 없습니다.</p></div>)}
      </div>
    </main>
  );
}
