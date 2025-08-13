import os
from dotenv import load_dotenv
from googleapiclient.discovery import build
import pandas as pd
from flask import Flask, jsonify, request as flask_request
from flask_cors import CORS

load_dotenv()
API_KEY = os.getenv('YOUTUBE_API_KEY')

app = Flask(__name__)
CORS(app)

youtube = build('youtube', 'v3', developerKey=API_KEY)

def GetVideoDetail(video_ids):
    if not video_ids:
        return []
    id_string = ",".join(video_ids)
    request = youtube.videos().list(
        part="snippet,statistics",
        id=id_string
    )
    response = request.execute()
    detailed_videos = []
    for item in response.get('items', []):
        channel_id = item['snippet']['channelId']
        video_data = {
            'video_id': item['id'],
            'title': item['snippet']['title'],
            'channel': item['snippet']['channelTitle'],
            'published_at': item['snippet']['publishedAt'],
            'channel_url': f"https://www.youtube.com/channel/{channel_id}",
            'view_count': int(item.get('statistics', {}).get('viewCount', 0)),
            'like_count': int(item.get('statistics', {}).get('likeCount', 0))
        }
        detailed_videos.append(video_data)
    return detailed_videos


def GetYoutube(query, max_results=10):
    if not API_KEY:
        raise ValueError("API 키가 설정되지 않았습니다. .env 파일을 확인하세요.")

    try:
        shorts_query = f"{query} #shorts"
        search_request = youtube.search().list(
            q=shorts_query,
            part='id',
            type='video',
            order='viewCount',
            maxResults=max_results,
            regionCode='KR'
        )
        response = search_request.execute()
        
        video_ids = [item['id']['videoId'] for item in response.get('items', [])]
        
        videos = GetVideoDetail(video_ids)

        videos.sort(key=lambda x: x['view_count'], reverse=True)
        
        return videos

    except Exception as e:
        print(f"오류가 발생했습니다: {e}")
        return None


@app.route('/api/videos', methods=['GET'])
def get_videos_api():
    SearchQuery = flask_request.args.get('category', '인기') 

    VideoList = GetYoutube(SearchQuery)
    
    if VideoList is not None:
        return jsonify(VideoList)
    else:
        return jsonify({"error": "데이터를 가져오는 중 오류가 발생했습니다."}), 500
    

if __name__ == "__main__":
    app.run(debug=True, port=5001)