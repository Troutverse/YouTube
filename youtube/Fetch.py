import os
from dotenv import load_dotenv
from googleapiclient.discovery import build
from flask import Flask, jsonify, request as flask_request
from flask_cors import CORS
from collections import Counter
import re
from datetime import datetime, timedelta, timezone
import math

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

# --- 데이터 수집 함수들 ---
def get_published_after_date(period):
    now = datetime.now(timezone.utc)
    if period == 'today':
        return (now - timedelta(days=1)).isoformat()
    if period == '3days':
        return (now - timedelta(days=3)).isoformat()
    if period == '5days':
        return (now - timedelta(days=5)).isoformat()
    if 'year' in period:
        try:
            years = int(re.findall(r'\d+', period)[0])
            return (now - timedelta(days=365 * years)).isoformat()
        except (ValueError, IndexError):
            return None
    if period == '1month': return (now - timedelta(days=30)).isoformat()
    if period == '1week': return (now - timedelta(days=7)).isoformat()
    return None

def GetVideoDetail(video_ids):
    if not video_ids: return []
    # 중복 제거된 ID 목록을 다시 콤마로 연결
    id_string = ",".join(list(video_ids))
    request = youtube.videos().list(part="snippet,statistics", id=id_string)
    response = request.execute()
    detailed_videos = []
    for item in response.get('items', []):
        stats = item.get('statistics', {})
        snippet = item.get('snippet', {})
        video_data = {
            'video_id': item['id'],
            'title': snippet.get('title'),
            'description': snippet.get('description'),
            'channel': snippet.get('channelTitle'),
            'channel_id': snippet.get('channelId'),
            'published_at': snippet.get('publishedAt'),
            'channel_url': f"https://www.youtube.com/channel/{snippet.get('channelId')}",
            'view_count': int(stats.get('viewCount', 0)),
            'like_count': int(stats.get('likeCount', 0))
        }
        detailed_videos.append(video_data)
    return detailed_videos

def GetYoutube(query, region_codes=['KR'], max_results=50, publishedAfter=None):
    try:
        categories = query.split(',')
        search_term = " OR ".join(categories) if len(categories) > 1 else query
        shorts_query = f"({search_term}) #shorts"

        all_video_ids = set()
        # 각 나라별로 API 할당량을 균등하게 배분
        results_per_region = math.ceil(max_results / len(region_codes))

        for region in region_codes:
            search_params = {
                'q': shorts_query,
                'part': 'id',
                'type': 'video',
                'order': 'viewCount',
                'maxResults': results_per_region,
                'regionCode': region
            }
            if publishedAfter:
                search_params['publishedAfter'] = publishedAfter

            search_request = youtube.search().list(**search_params)
            response = search_request.execute()
            
            for item in response.get('items', []):
                all_video_ids.add(item['id']['videoId'])
        
        if not all_video_ids: return []
        return GetVideoDetail(list(all_video_ids))
    except Exception as e:
        print(f"YouTube 데이터 수집 중 오류 발생: {e}")
        return None

# --- 새로운 엔드포인트: 채널 분석 ---
@app.route('/api/channel/<channel_id>', methods=['GET'])
def get_channel_videos(channel_id):
    try:
        search_request = youtube.search().list(part='id', channelId=channel_id, order='date', type='video', maxResults=50)
        response = search_request.execute()
        video_ids = [item['id']['videoId'] for item in response.get('items', [])]
        if not video_ids: return jsonify([])
        return jsonify(GetVideoDetail(video_ids))
    except Exception as e:
        print(f"채널 영상 수집 중 오류 발생: {e}")
        return jsonify({"error": "채널 영상을 가져오는 중 오류가 발생했습니다."}), 500

# --- 분석 함수들 (이전과 동일) ---
def analyze_engagement(videos):
    for video in videos:
        view_count = video.get('view_count', 0)
        like_count = video.get('like_count', 0)
        video['like_to_view_ratio'] = round((like_count / view_count) * 100, 2) if view_count > 0 else 0
    return videos

# ... (이하 다른 분석 함수들은 이전과 동일하게 유지) ...

@app.route('/api/videos', methods=['GET'])
def get_videos_with_analysis():
    SearchQuery = flask_request.args.get('category', '인기') 
    period = flask_request.args.get('period', 'all')
    # 국가 파라미터 추가 (기본값: KR)
    countries = flask_request.args.get('countries', 'KR').split(',')
    
    published_after = get_published_after_date(period)
    video_list = GetYoutube(SearchQuery, region_codes=countries, publishedAfter=published_after)
    
    if video_list is None: return jsonify({"error": "데이터를 가져오는 중 오류가 발생했습니다."}), 500
    if not video_list: return jsonify({"videos": [], "analysis": None})

    videos_with_metrics = analyze_engagement(video_list)
    # ... (기존 분석 로직들)
    # This part is shortened for brevity but should contain all analysis functions
    analysis_results = {
        'keyword_analysis': [], # Placeholder
        'title_length_analysis': {'average_title_length': 0}, # Placeholder
        'channel_analysis': {'top_channels_by_video_count': [], 'top_channels_by_avg_views': []}, # Placeholder
        'time_analysis': {'upload_hour_distribution': {}, 'upload_day_distribution': {}}, # Placeholder
        'sentiment_analysis': {}, # Placeholder
        'breakout_videos': [], # Placeholder
        'title_pattern_analysis': {}, # Placeholder
        'correlation_analysis': {} # Placeholder
    }
    return jsonify({'videos': videos_with_metrics, 'analysis': analysis_results})

if __name__ == "__main__":
    app.run(debug=True, port=5001)
