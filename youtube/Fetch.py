import os
from dotenv import load_dotenv
from googleapiclient.discovery import build
from flask import Flask, jsonify, request as flask_request
from flask_cors import CORS
from collections import Counter
import re
from datetime import datetime, timedelta, timezone

# .env 파일에서 환경 변수를 로드합니다.
load_dotenv()
API_KEY = os.getenv('YOUTUBE_API_KEY')

# Flask 앱을 초기화하고 CORS를 설정합니다.
app = Flask(__name__)
CORS(app)

# YouTube API 클라이언트를 빌드합니다.
if not API_KEY:
    raise ValueError("YOUTUBE_API_KEY가 .env 파일에 설정되지 않았습니다.")
youtube = build('youtube', 'v3', developerKey=API_KEY)

def get_published_after_date(period):
    """
    '1year', '2year' 같은 문자열을 API가 요구하는 날짜 형식으로 변환합니다.
    """
    now = datetime.now(timezone.utc)
    years_to_subtract = 0
    if period.endswith('year'):
        try:
            years_to_subtract = int(period.replace('year', ''))
            return (now - timedelta(days=365 * years_to_subtract)).isoformat()
        except ValueError:
            return None
    elif period == '1month':
        return (now - timedelta(days=30)).isoformat()
    elif period == '1week':
        return (now - timedelta(days=7)).isoformat()
    return None

def GetVideoDetail(video_ids):
    """
    비디오 ID 목록을 받아 각 비디오의 상세 정보(통계 포함)를 반환합니다.
    """
    if not video_ids: return []
    id_string = ",".join(video_ids)
    request = youtube.videos().list(part="snippet,statistics", id=id_string)
    response = request.execute()
    detailed_videos = []
    for item in response.get('items', []):
        stats = item.get('statistics', {})
        video_data = {
            'video_id': item['id'],
            'title': item['snippet']['title'],
            'channel': item['snippet']['channelTitle'],
            'published_at': item['snippet']['publishedAt'],
            'channel_url': f"https://www.youtube.com/channel/{item['snippet']['channelId']}",
            'view_count': int(stats.get('viewCount', 0)),
            'like_count': int(stats.get('likeCount', 0))
        }
        detailed_videos.append(video_data)
    return detailed_videos

def GetYoutube(query, max_results=50, publishedAfter=None):
    """
    다중 선택된 카테고리로 YouTube 쇼츠를 검색하고 비디오 목록을 반환합니다.
    """
    try:
        # 콤마로 구분된 카테고리 문자열을 리스트로 변환
        categories = query.split(',')
        # 검색 쿼리 생성: (카테고리1 OR 카테고리2) #shorts
        if len(categories) > 1:
            search_term = " OR ".join(categories)
            shorts_query = f"({search_term}) #shorts"
        else:
            shorts_query = f"{query} #shorts"

        search_params = {
            'q': shorts_query,
            'part': 'id',
            'type': 'video',
            'order': 'viewCount',
            'maxResults': max_results,
            'regionCode': 'KR'
        }
        if publishedAfter:
            search_params['publishedAfter'] = publishedAfter

        search_request = youtube.search().list(**search_params)
        response = search_request.execute()
        
        video_ids = [item['id']['videoId'] for item in response.get('items', [])]
        
        if not video_ids: return []
        return GetVideoDetail(video_ids)

    except Exception as e:
        print(f"YouTube 데이터 수집 중 오류 발생: {e}")
        return None

# --- 분석 함수들 (이전과 동일) ---
def analyze_engagement(videos):
    for video in videos:
        view_count = video.get('view_count', 0)
        like_count = video.get('like_count', 0)
        video['like_to_view_ratio'] = round((like_count / view_count) * 100, 2) if view_count > 0 else 0
    return videos

def analyze_keywords(videos, top_n=10):
    if not videos: return []
    all_titles = " ".join([video['title'] for video in videos])
    words = re.findall(r'[\w가-힣]+', all_titles.lower())
    stopwords = {'shorts', 'challenge', 'tiktok', 'youtube', 'the', 'and', 'is', 'in', 'it', 'of'}
    filtered_words = [word for word in words if word not in stopwords and not word.isdigit()]
    return Counter(filtered_words).most_common(top_n)

def analyze_title_length(videos):
    if not videos: return {'average_title_length': 0}
    return {'average_title_length': round(sum(len(v['title']) for v in videos) / len(videos), 2)}

def analyze_channels(videos, top_n=5):
    if not videos: return {'top_channels_by_video_count': [], 'top_channels_by_avg_views': []}
    channel_videos = {}
    for video in videos:
        channel_name = video['channel']
        if channel_name not in channel_videos: channel_videos[channel_name] = []
        channel_videos[channel_name].append(video)
    top_channels_by_count = sorted(channel_videos.items(), key=lambda item: len(item[1]), reverse=True)[:top_n]
    channel_performance = [{'channel': name, 'average_views': int(sum(v['view_count'] for v in vids) / len(vids)), 'video_count': len(vids)} for name, vids in channel_videos.items()]
    sorted_performance = sorted(channel_performance, key=lambda x: x['average_views'], reverse=True)[:top_n]
    return {'top_channels_by_video_count': [{'channel': name, 'video_count': len(vids)} for name, vids in top_channels_by_count], 'top_channels_by_avg_views': sorted_performance}

def analyze_publish_time(videos):
    if not videos: return {'upload_hour_distribution': {}, 'upload_day_distribution': {}}
    publish_times = [datetime.fromisoformat(v['published_at'].replace('Z', '+00:00')) for v in videos]
    return {'upload_hour_distribution': dict(Counter(t.hour for t in publish_times).most_common()), 'upload_day_distribution': dict(Counter(t.strftime('%A') for t in publish_times).most_common())}

@app.route('/api/videos', methods=['GET'])
def get_videos_with_analysis():
    SearchQuery = flask_request.args.get('category', '인기') 
    period = flask_request.args.get('period', 'all')
    
    published_after = get_published_after_date(period)
    video_list = GetYoutube(SearchQuery, publishedAfter=published_after)
    
    if video_list is None: return jsonify({"error": "데이터를 가져오는 중 오류가 발생했습니다."}), 500
    if not video_list: return jsonify({"videos": [], "analysis": None, "message": "해당 검색어에 대한 쇼츠를 찾을 수 없습니다."})

    videos_with_metrics = analyze_engagement(video_list)
    analysis_results = {
        'keyword_analysis': analyze_keywords(video_list),
        'title_length_analysis': analyze_title_length(video_list),
        'channel_analysis': analyze_channels(video_list),
        'time_analysis': analyze_publish_time(video_list)
    }
    return jsonify({'videos': videos_with_metrics, 'analysis': analysis_results})

if __name__ == "__main__":
    app.run(debug=True, port=5001)
