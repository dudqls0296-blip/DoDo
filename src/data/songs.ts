// 고민저장소 · 검증된 실제 곡 큐레이션 목록
// 모든 videoId는 2026-11-25에 YouTube oEmbed(https://www.youtube.com/oembed)로
// 제목·채널을 확인했고, oEmbed가 응답한 영상만 넣었다(삽입 허용 영상).
// 추천 로직은 이 목록 밖의 곡이나 URL을 만들어내지 않는다.

export type Need = 'same' | 'calm' | 'energy';
export type Lang = 'ko' | 'en' | 'inst';
export type CategoryId = 'career' | 'study' | 'relation' | 'self' | 'burnout' | 'etc';

export interface Song {
  id: string;
  title: string;
  artist: string;
  videoId: string;
  /** oEmbed author_name (공식 채널·레이블·VEVO·Topic) */
  channel: string;
  /** oEmbed title */
  videoTitle: string;
  lang: Lang;
  vocal: boolean;
  genre: string;
  needs: Need[];
  /** 특히 잘 맞는 고민 맥락 */
  themes: CategoryId[];
  /** 집중용으로 쓰기 좋은 곡 */
  focus?: boolean;
  /** 이별·관계 이야기가 분명한 곡: themes에 있는 고민에만 추천 */
  strict?: boolean;
  /** 곡의 소리 — 사실에 근거한 짧은 묘사 */
  sound: string;
  /** 곡의 이야기·분위기 */
  story: string;
}

export const VERIFIED_AT = '2026-11-25';

export const SONGS: Song[] = [
  // ── 한국어 ──
  { id: 'iu-through-the-night', title: '밤편지', artist: '아이유 (IU)', videoId: 'BzYnNdJhZQw', channel: '1theK (원더케이)', videoTitle: '[MV] IU(아이유) _ Through the Night(밤편지)', lang: 'ko', vocal: true, genre: '어쿠스틱 발라드', needs: ['calm'], themes: ['relation', 'burnout', 'etc'],
    sound: '어쿠스틱 기타와 낮고 부드러운 목소리가 느린 템포로 이어져요', story: '밤에 조용히 편지를 쓰듯, 말을 아끼며 마음을 건네는 노래예요' },
  { id: 'bts-spring-day', title: '봄날', artist: '방탄소년단 (BTS)', videoId: 'xEeFrLSkMm8', channel: 'HYBE LABELS', videoTitle: "BTS (방탄소년단) '봄날 (Spring Day)' Official MV", lang: 'ko', vocal: true, genre: '팝 록 발라드', needs: ['same', 'calm'], themes: ['relation', 'self', 'etc'],
    sound: '미디엄 템포로 차분히 시작해 후렴에서 넓게 퍼져요', story: '보고 싶은 마음과 기다림을 담고, 끝내 봄날은 온다고 말하는 노래예요' },
  { id: 'bts-life-goes-on', title: 'Life Goes On', artist: '방탄소년단 (BTS)', videoId: '-5q5mZbe3V8', channel: 'HYBE LABELS', videoTitle: "BTS (방탄소년단) 'Life Goes On' Official MV", lang: 'ko', vocal: true, genre: '어쿠스틱 팝', needs: ['calm', 'same'], themes: ['burnout', 'career', 'etc'],
    sound: '잔잔한 어쿠스틱 기타 위로 담담한 목소리가 흘러가요', story: '일상이 멈춘 것 같은 때에도 삶은 계속된다고 조용히 말하는 노래예요' },
  { id: 'iu-blueming', title: 'Blueming', artist: '아이유 (IU)', videoId: 'D1PvIWdJ8xo', channel: '1theK (원더케이)', videoTitle: '[MV] IU(아이유) _ Blueming(블루밍)', lang: 'ko', vocal: true, genre: '팝 록', needs: ['energy'], themes: ['relation', 'etc'],
    sound: '밝은 기타와 경쾌한 밴드 사운드가 가볍게 튀어 올라요', story: '설레는 마음이 꽃처럼 피어나는 산뜻한 노래예요' },
  { id: 'day6-time-of-our-life', title: '한 페이지가 될 수 있게', artist: 'DAY6', videoId: 'vnS_jn2uibs', channel: 'JYP Entertainment', videoTitle: 'DAY6 "Time of Our Life(한 페이지가 될 수 있게)" M/V', lang: 'ko', vocal: true, genre: '밴드 록', needs: ['energy'], themes: ['career', 'study', 'relation', 'self'],
    sound: '시원한 기타와 앞으로 달려가는 드럼이 처음부터 끝까지 힘 있게 이어져요', story: '지금 이 시간이 청춘의 한 페이지가 되길 바라는 노래예요' },
  { id: 'leehi-breathe', title: '한숨', artist: '이하이 (LEE HI)', videoId: '5iSlfF8TQ9k', channel: 'OfficialLEEHI', videoTitle: "LEE HI - '한숨 (BREATHE)' M/V", lang: 'ko', vocal: true, genre: '피아노 발라드', needs: ['same', 'calm'], themes: ['burnout', 'self', 'etc'],
    sound: '피아노와 따뜻한 목소리가 천천히 숨을 고르듯 이어져요', story: '한숨을 쉬어도 괜찮다고, 수고했다고 다독이는 노래예요' },
  { id: 'bts-dynamite', title: 'Dynamite', artist: '방탄소년단 (BTS)', videoId: 'gdZLi9oWNZg', channel: 'HYBE LABELS', videoTitle: "BTS (방탄소년단) 'Dynamite' Official MV", lang: 'ko', vocal: true, genre: '디스코 팝', needs: ['energy'], themes: ['burnout', 'etc'],
    sound: '밝은 디스코 리듬과 브라스가 몸을 먼저 움직이게 해요', story: '반짝이는 기분을 터뜨리는 신나는 노래예요 (가사는 영어)' },
  { id: 'iu-palette', title: '팔레트 (feat. G-DRAGON)', artist: '아이유 (IU)', videoId: 'd9IxdwEFk1c', channel: '1theK (원더케이)', videoTitle: '[MV] IU(아이유) _ Palette(팔레트) (Feat. G-DRAGON)', lang: 'ko', vocal: true, genre: 'R&B 팝', needs: ['calm'], themes: ['self', 'career'],
    sound: '느긋한 리듬 위로 가볍게 말하듯 노래해요', story: '이제 나를 조금 알 것 같다며, 내가 좋아하는 것들을 하나씩 꼽는 노래예요' },
  { id: 'iu-love-wins-all', title: 'Love wins all', artist: '아이유 (IU)', videoId: 'JleoAppaxi0', channel: '이지금 [IU Official]', videoTitle: "IU 'Love wins all' MV", lang: 'ko', vocal: true, genre: '발라드', needs: ['same'], themes: ['relation', 'etc'],
    sound: '조용히 시작해 점점 웅장하게 차오르는 발라드예요', story: '모든 것이 어려운 순간에도 서로를 지키는 마음을 노래해요' },
  { id: 'iu-eight', title: '에잇 (Prod.&Feat. SUGA of BTS)', artist: '아이유 (IU)', videoId: 'TgOu00Mf3kI', channel: '1theK (원더케이)', videoTitle: '[MV] IU(아이유) _ eight(에잇) (Prod.&Feat. SUGA of BTS)', lang: 'ko', vocal: true, genre: '모던 록', needs: ['same'], themes: ['career', 'relation', 'etc'],
    sound: '밝은 밴드 사운드인데 가사는 쓸쓸해서, 웃으면서 우는 듯한 느낌이에요', story: '지나간 시간과 그리운 마음을 붙잡아 두고 싶은 노래예요' },
  { id: 'bts-butter', title: 'Butter', artist: '방탄소년단 (BTS)', videoId: 'WMweEpGlu_U', channel: 'HYBE LABELS', videoTitle: "BTS (방탄소년단) 'Butter' Official MV", lang: 'ko', vocal: true, genre: '댄스 팝', needs: ['energy'], themes: ['self', 'etc'],
    sound: '가볍게 튀는 베이스와 박수 소리가 경쾌하게 이어져요', story: '부드럽고 자신감 있는 기분을 끌어올리는 노래예요 (가사는 영어)' },
  { id: 'akmu-heartbreak', strict: true, title: '어떻게 이별까지 사랑하겠어, 널 사랑하는 거지', artist: 'AKMU (악뮤)', videoId: 'm3DZsBw5bnE', channel: 'AKMU', videoTitle: "AKMU - '어떻게 이별까지 사랑하겠어, 널 사랑하는 거지(How can I love the heartbreak, you`re the one I love)' M/V", lang: 'ko', vocal: true, genre: '발라드', needs: ['same'], themes: ['relation'],
    sound: '담백한 반주 위로 감정을 꾹 눌러 담은 목소리가 이어져요', story: '이별 앞에서도 사랑하는 마음을 어쩌지 못하는 노래예요' },

  // ── 영어 ──
  { id: 'coldplay-fix-you', title: 'Fix You', artist: 'Coldplay', videoId: 'k4V3Mo61fJM', channel: 'Coldplay', videoTitle: 'Coldplay - Fix You (Official Video)', lang: 'en', vocal: true, genre: '얼터너티브 록', needs: ['same', 'calm'], themes: ['burnout', 'self', 'relation', 'study'],
    sound: '오르간과 피아노로 아주 조용히 시작했다가, 후반에 기타와 드럼이 한꺼번에 차올라요', story: '애써도 안 될 때 곁에서 집으로 데려다주겠다고 말하는 노래예요' },
  { id: 'coldplay-viva-la-vida', title: 'Viva La Vida', artist: 'Coldplay', videoId: 'dvgZkm1xWPE', channel: 'Coldplay', videoTitle: 'Coldplay - Viva La Vida (Official Video)', lang: 'en', vocal: true, genre: '얼터너티브 록', needs: ['energy'], themes: ['career', 'study'],
    sound: '현악기가 끊어 치는 리듬과 큰 북소리가 행진하듯 앞으로 나가요', story: '한때 세상을 다 가졌던 왕이 지난날을 돌아보는 노래예요' },
  { id: 'avicii-wake-me-up', title: 'Wake Me Up', artist: 'Avicii', videoId: 'IcrbM1l_BoI', channel: 'AviciiOfficialVEVO', videoTitle: 'Avicii - Wake Me Up (Official Video)', lang: 'en', vocal: true, genre: '포크 EDM', needs: ['energy'], themes: ['career', 'self'],
    sound: '어쿠스틱 기타로 시작해 후렴에서 전자음이 시원하게 터져요', story: '아직 길을 찾는 중이라고, 다 알게 되면 깨워달라고 말하는 노래예요' },
  { id: 'imagine-dragons-believer', title: 'Believer', artist: 'Imagine Dragons', videoId: '7wtfhZwyrcc', channel: 'ImagineDragonsVEVO', videoTitle: 'Imagine Dragons - Believer (Official Music Video)', lang: 'en', vocal: true, genre: '팝 록', needs: ['energy'], themes: ['self', 'burnout', 'study'],
    sound: '묵직한 드럼과 강한 목소리가 쿵쿵 밀고 들어와요', story: '고통이 나를 믿는 사람으로 만들었다고 외치는 노래예요' },
  { id: 'survivor-eye-of-the-tiger', title: 'Eye of the Tiger', artist: 'Survivor', videoId: 'btPJPFnesV4', channel: 'SurvivorVEVO', videoTitle: 'Survivor - Eye Of The Tiger (Official HD Video)', lang: 'en', vocal: true, genre: '록', needs: ['energy'], themes: ['study', 'career'], focus: true,
    sound: '끊어 치는 기타 리프가 처음부터 박자를 단단하게 잡아줘요', story: '다시 일어나 끝까지 버티는 투지를 노래해요' },
  { id: 'queen-dont-stop-me-now', title: "Don't Stop Me Now", artist: 'Queen', videoId: 'HgzGwKwLmgM', channel: 'Queen Official', videoTitle: "Queen - Don't Stop Me Now (Official Video)", lang: 'en', vocal: true, genre: '록', needs: ['energy'], themes: ['burnout', 'etc'],
    sound: '피아노로 천천히 시작했다가 갑자기 속도가 붙어 끝까지 질주해요', story: '지금 너무 좋은 기분이니 멈추지 말라고 외치는 노래예요' },
  { id: 'rachel-platten-fight-song', title: 'Fight Song', artist: 'Rachel Platten', videoId: 'xo1VInw-SKc', channel: 'RachelPlattenVEVO', videoTitle: 'Rachel Platten - Fight Song (Official Video)', lang: 'en', vocal: true, genre: '팝', needs: ['energy'], themes: ['self', 'study', 'career'],
    sound: '피아노로 작게 시작해 후렴에서 크게 고조돼요', story: '작은 목소리라도 아직 나에게 힘이 남아 있다고 말하는 노래예요' },
  { id: 'kodaline-all-i-want', strict: true, title: 'All I Want', artist: 'Kodaline', videoId: 'mtf7hC17IBM', channel: 'KodalineVEVO', videoTitle: 'Kodaline - All I Want (Part 1)', lang: 'en', vocal: true, genre: '인디 발라드', needs: ['same'], themes: ['relation'],
    sound: '느린 피아노와 기타 위로 여린 목소리가 쌓여 가요', story: '곁에 있어 줄 누군가를 기다리는 외로움을 노래해요' },
  { id: 'billie-eilish-everything-i-wanted', title: 'everything i wanted', artist: 'Billie Eilish', videoId: 'EgBJmlPo8Xw', channel: 'BillieEilishVEVO', videoTitle: 'Billie Eilish - everything i wanted', lang: 'en', vocal: true, genre: '얼터너티브 팝', needs: ['same', 'calm'], themes: ['burnout', 'self', 'relation'],
    sound: '낮게 속삭이는 목소리와 단순한 전자음이 조용히 깔려요', story: '모든 게 무너지는 순간에도 곁에서 지켜주는 사람이 있다는 노래예요' },
  { id: 'keane-somewhere-only-we-know', title: 'Somewhere Only We Know', artist: 'Keane', videoId: 'Oextk-If8HQ', channel: 'KeaneVEVO', videoTitle: 'Keane - Somewhere Only We Know (Official Music Video)', lang: 'en', vocal: true, genre: '피아노 록', needs: ['calm'], themes: ['relation', 'etc'],
    sound: '반복되는 피아노 리프 위로 맑은 목소리가 흘러가요', story: '우리만 아는 쉴 곳으로 함께 가자고 하는 노래예요' },
  { id: 'beatles-let-it-be', title: 'Let It Be', artist: 'The Beatles', videoId: 'QDYfEBY9NM4', channel: 'The Beatles - Topic', videoTitle: 'Let It Be (Remastered 2009)', lang: 'en', vocal: true, genre: '피아노 록', needs: ['calm'], themes: ['burnout', 'etc', 'self'],
    sound: '피아노 코드와 담담한 목소리로 천천히 시작해요', story: '힘든 순간엔 그냥 흘러가게 두라고 말하는 노래예요' },
  { id: 'ed-sheeran-photograph', strict: true, title: 'Photograph', artist: 'Ed Sheeran', videoId: 'nSDgHBxUbVQ', channel: 'Ed Sheeran', videoTitle: 'Ed Sheeran - Photograph (Official Music Video)', lang: 'en', vocal: true, genre: '어쿠스틱 팝', needs: ['calm'], themes: ['relation'],
    sound: '기타와 피아노가 부드럽게 이어지는 미디엄 템포예요', story: '사진 속 추억처럼 사랑을 간직하는 노래예요' },
  { id: 'pharrell-happy', title: 'Happy', artist: 'Pharrell Williams', videoId: 'ZbZSe6N_BXs', channel: 'PharrellWilliamsVEVO', videoTitle: 'Pharrell Williams - Happy (Official Video)', lang: 'en', vocal: true, genre: '소울 팝', needs: ['energy'], themes: ['burnout', 'etc'],
    sound: '박수 소리와 가벼운 리듬이 자연스럽게 어깨를 들썩이게 해요', story: '이유 없이 기분 좋아지는 순간을 노래해요' },
  { id: 'lewis-capaldi-someone-you-loved', strict: true, title: 'Someone You Loved', artist: 'Lewis Capaldi', videoId: 'zABLecsR5UE', channel: 'LewisCapaldiVEVO', videoTitle: 'Lewis Capaldi - Someone You Loved', lang: 'en', vocal: true, genre: '피아노 발라드', needs: ['same'], themes: ['relation'],
    sound: '피아노 하나와 거친 목소리가 감정을 그대로 드러내요', story: '사랑하던 사람을 잃은 뒤의 허전함을 노래해요' },
  { id: 'bill-withers-lean-on-me', title: 'Lean on Me', artist: 'Bill Withers', videoId: 'fOZ-MySzAac', channel: 'Bill Withers - Topic', videoTitle: 'Lean on Me', lang: 'en', vocal: true, genre: '소울', needs: ['calm'], themes: ['relation', 'burnout'],
    sound: '단순한 피아노와 담백한 목소리가 편안하게 흘러가요', story: '힘들 땐 나에게 기대도 된다고 말하는 노래예요' },
  { id: 'katy-perry-roar', title: 'Roar', artist: 'Katy Perry', videoId: 'CevxZvSJLk8', channel: 'KatyPerryVEVO', videoTitle: 'Katy Perry - Roar', lang: 'en', vocal: true, genre: '팝', needs: ['energy'], themes: ['self'],
    sound: '힘 있는 드럼과 시원한 후렴이 점점 크게 울려요', story: '참아 왔던 목소리를 다시 크게 내는 노래예요' },
  { id: 'justin-bieber-love-yourself', strict: true, title: 'Love Yourself', artist: 'Justin Bieber', videoId: 'oyEuk8j8imI', channel: 'JustinBieberVEVO', videoTitle: 'Justin Bieber - Love Yourself (PURPOSE : The Movement)', lang: 'en', vocal: true, genre: '어쿠스틱 팝', needs: ['calm'], themes: ['relation'],
    sound: '어쿠스틱 기타 하나로 가볍고 담백하게 이어져요', story: '나를 힘들게 한 관계에서 한 걸음 물러서는 노래예요' },

  // ── 연주곡 (가사 없음) ──
  { id: 'yiruma-river-flows-in-you', title: 'River Flows in You', artist: '이루마 (Yiruma)', videoId: '7maJOI3QMu0', channel: 'YirumaVEVO', videoTitle: 'Yiruma, (이루마) - River Flows in You', lang: 'inst', vocal: false, genre: '피아노 연주곡', needs: ['calm'], themes: ['study', 'burnout', 'self', 'etc'], focus: true,
    sound: '가사 없이 피아노 한 대가 물 흐르듯 이어져요', story: '말 없이 생각을 정리하기 좋은 곡이에요' },
  { id: 'einaudi-experience', title: 'Experience', artist: 'Ludovico Einaudi', videoId: 'hN_q-_nGv4U', channel: 'LudovicoEinaudiVEVO', videoTitle: 'Ludovico Einaudi - Experience (Live At Fabric, London / 2013)', lang: 'inst', vocal: false, genre: '현대 피아노·현악 연주곡', needs: ['energy', 'calm'], themes: ['study', 'career'], focus: true,
    sound: '같은 피아노 음형이 반복되다가 현악이 겹치며 천천히 고조돼요', story: '가사 없이 한 방향으로 쌓여 가서 집중을 붙잡아 두기 좋은 곡이에요' },
  { id: 'max-richter-daylight', title: 'On the Nature of Daylight', artist: 'Max Richter', videoId: 'rVN1B-tUpgs', channel: 'Fatcat Records', videoTitle: 'Max Richter - On the Nature of Daylight', lang: 'inst', vocal: false, genre: '현악 연주곡', needs: ['same', 'calm'], themes: ['burnout', 'relation', 'self', 'etc'],
    sound: '느린 현악기가 길게 겹치며 무겁고 고요하게 흘러가요', story: '슬픔을 서둘러 밀어내지 않고 그 곁에 잠시 머무는 곡이에요' },
];

export const watchUrl = (s: Song) => `https://www.youtube.com/watch?v=${s.videoId}`;
export const searchUrl = (s: Pick<Song, 'title' | 'artist'>) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(`${s.title} ${s.artist}`)}`;
