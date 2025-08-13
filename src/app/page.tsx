'use client';

import { useState, useEffect } from 'react';
import { Youtube, User, Eye, } from 'lucide-react';

// API로부터 받아올 비디오 데이터의 타입을 정의합니다.
interface Video {
  video_id: string;
  title: string;
  channel: string;
  channel_url: string;
  view_count: number;
  like_count: number;
  published_at: string;
}

// 조회수를 간결하게 포맷하는 함수 (예: 12345 -> 12.3K)
const formatViews = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toString();
};

export default function Home() {
  // 비디오 목록, 로딩 상태, 에러 상태를 관리합니다.
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 컴포넌트가 처음 렌더링될 때 API로부터 비디오 데이터를 가져옵니다.
  useEffect(() => {
    const fetchVideos = async () => {
      try {
        // 백엔드 API 주소입니다. Flask 서버가 5001 포트에서 실행 중이어야 합니다.
        const response = await fetch('http://localhost:5001/api/videos?category=인기');
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        setVideos(data);
      } catch (e) {
        console.error("Failed to fetch videos:", e);
        setError('데이터를 불러오는 데 실패했습니다. API 서버가 실행 중인지 확인해주세요.');
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, []); // 빈 배열을 전달하여 이 effect가 한 번만 실행되도록 합니다.

  // 로딩 중일 때 표시할 UI
  if (loading) {
    return (
      <main className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="flex flex-col items-center gap-4">
          <Youtube className="w-16 h-16 animate-pulse text-red-500" />
          <p className="text-xl">인기 쇼츠를 불러오는 중입니다...</p>
        </div>
      </main>
    );
  }

  // 에러 발생 시 표시할 UI
  if (error) {
    return (
      <main className="flex items-center justify-center min-h-screen bg-gray-900 text-red-400">
        <p className="text-xl">{error}</p>
      </main>
    );
  }

  // 데이터 로딩 성공 시 비디오 목록을 표시할 UI
  return (
    <main className="min-h-screen bg-gray-900 text-white p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight flex items-center justify-center gap-3">
            <Youtube className="w-10 h-10 text-red-600" />
            <span>오늘의 인기 쇼츠</span>
          </h1>
          <p className="text-gray-400 mt-2">알고리즘이 추천하는 인기 유튜브 쇼츠 영상들입니다.</p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {videos.map((video) => (
            <div key={video.video_id} className="bg-gray-800 rounded-xl overflow-hidden shadow-lg flex flex-col transition-transform duration-300 hover:scale-105 hover:shadow-red-500/20">
              {/* 유튜브 비디오 임베드 */}
              <div className="aspect-[9/16] w-full">
                <iframe
                  className="w-full h-full"
                  src={`https://www.youtube.com/embed/${video.video_id}`}
                  title={video.title}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
              
              <div className="p-4 flex flex-col flex-grow">
                {/* 비디오 제목 */}
                <h3 className="font-semibold text-base text-gray-100 mb-2 leading-snug flex-grow" title={video.title}>
                  {video.title.length > 50 ? `${video.title.substring(0, 50)}...` : video.title}
                </h3>

                <div className="mt-auto">
                  {/* 채널 정보 */}
                  <a
                    href={video.channel_url}
                    target="_blank" // 새 탭에서 열기
                    rel="noopener noreferrer" // 보안 속성
                    className="flex items-center gap-2 text-sm text-gray-400 hover:text-red-400 transition-colors duration-200"
                  >
                    <User className="w-4 h-4" />
                    <span className="truncate">{video.channel}</span>
                  </a>

                  {/* 조회수 정보 */}
                  <div className="flex items-center gap-2 text-sm text-gray-400 mt-2">
                    <Eye className="w-4 h-4" />
                    <span>조회수 {formatViews(video.view_count)}회</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
