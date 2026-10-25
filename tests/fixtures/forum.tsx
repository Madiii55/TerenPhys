// Development-only UI scenarios. This adapter never writes to the real database.
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ForumPage} from '../../src/components/ForumPage.tsx';
import {AuthContext, type AuthContextType, type UserProfile} from '../../src/context/AuthContext.tsx';
import type {ForumApi} from '../../src/forum/api.ts';
import type {ForumTopic,ForumComment} from '../../src/forum/model.ts';
import {CosmicBackground} from '../../src/components/CosmicBackground.tsx';
import '../../src/index.css';
if(!import.meta.env.DEV) throw new Error('Development fixture only');
const profile:UserProfile={id:'demo-user',name:'Мади',email:'demo@example.test',bio:'',provider:'email',emailVerified:true,createdAt:'2026-10-03T08:00:00Z'};
const sample = [
 ['Почему спутник всё время падает, но не достигает Земли?','Пытаюсь разобраться с орбитальным движением. Если сила тяжести действует постоянно, почему спутник не приближается к поверхности? Куда направлено его ускорение?',9,'mechanics','Алина',128,12],
 ['Откуда берётся энергия при охлаждении воды?','В задаче нужно найти количество теплоты. Хочется понять, что на самом деле происходит с движением молекул, когда температура понижается.',8,'thermal','Данияр',246,8],
 ['Можно ли увидеть свет, если смотреть на луч сбоку?','В вакууме луч лазера не виден сбоку, а в тумане — виден. Правильно ли я понимаю, что всё дело в рассеянии на маленьких каплях?',8,'optics','София',81,24],
 ['Что покажут весы в падающем лифте?','Сила тяжести ведь никуда не исчезает. Почему тогда говорят о невесомости? Хочу разобраться в разнице между весом и силой тяжести.',7,'mechanics','Арман',63,7],
 ['Что общего у электрического и магнитного полей?','Начали электромагнетизм. Поделитесь хорошим объяснением того, как связаны эти два поля и почему движущийся заряд создаёт магнитное поле.',9,'magnetism','Алина',51,4],
 ['Как оценить расстояние до ближайшей звезды?','Можно ли повторить измерение параллакса на школьном оборудовании? Обсуждаем, какие углы придётся измерять и какой точности можно достичь.',null,'astronomy','Мади',36,3],
] as const;
let topics:ForumTopic[]=sample.map((s,i)=>({id:'demo-'+i,title:s[0],body:s[1],grade:s[2],category:s[3],author_name:s[4],author_id:'demo-author-'+i,author_avatar_path:null,view_count:s[5],like_count:s[6],comment_count:i===0?2:0,created_at:'2026-10-0'+(3-Math.floor(i/2))+'T08:00:00Z'}));
let comments:ForumComment[]=[
 {id:'comment-one',topic_id:'demo-0',author_id:'demo-author-1',author_name:'Данияр',author_avatar_path:null,body:'Важна начальная скорость по касательной. Пока спутник падает, поверхность Земли тоже «уходит» от него из-за кривизны.',parent_id:null,created_at:'2026-10-03T09:00:00Z'},
 {id:'comment-two',topic_id:'demo-0',author_id:'demo-author-0',author_name:'Алина',author_avatar_path:null,body:'Теперь понятнее! Получается, ускорение направлено к центру Земли, а скорость в каждый момент — по касательной?',parent_id:'comment-one',created_at:'2026-10-03T09:15:00Z'},
];
const likes=new Set<string>(),views=new Set<string>(),listeners=new Set<()=>void>();
const notify=()=>listeners.forEach(cb=>cb());
const api:ForumApi={
 async list(f,page){let rows=topics.filter(t=>(f.grade===null||t.grade===f.grade)&&(!f.category||t.category===f.category)&&(!f.search||(t.title+' '+t.body).toLocaleLowerCase('ru').includes(f.search.toLocaleLowerCase('ru'))));rows.sort((a,b)=>f.sort==='popular'?b.view_count-a.view_count:f.sort==='best'?b.like_count-a.like_count:b.created_at.localeCompare(a.created_at));return {topics:structuredClone(rows.slice(page*15,page*15+15)),total:rows.length};},
 async topic(id){return structuredClone(topics.find(t=>t.id===id)||null);},
 async comments(id,limit){const rows=comments.filter(c=>c.topic_id===id);return{comments:structuredClone(rows.slice(-limit)),total:rows.length};},
 async liked(id){return likes.has(id);},
 async createTopic(draft,userId){const topic:ForumTopic={...draft,id:crypto.randomUUID(),author_id:userId,author_name:profile.name,author_avatar_path:null,view_count:0,like_count:0,comment_count:0,created_at:new Date().toISOString()};topics=[topic,...topics];notify();return structuredClone(topic);},
 async createComment(topic_id,body,parent_id,author_id){const row:ForumComment={id:crypto.randomUUID(),topic_id,body,parent_id,author_id,author_name:profile.name,author_avatar_path:null,created_at:new Date().toISOString()};comments.push(row);topics.find(t=>t.id===topic_id)!.comment_count++;notify();return structuredClone(row);},
 async setLike(id,_userId,liked){const topic=topics.find(t=>t.id===id)!;if(liked&&!likes.has(id)){likes.add(id);topic.like_count++;}if(!liked&&likes.has(id)){likes.delete(id);topic.like_count--;}notify();},
 async recordView(id){const topic=topics.find(t=>t.id===id);if(!topic)return null;if(!views.has(id)){views.add(id);topic.view_count++;notify();}return topic.view_count;},
 subscribe(_id,cb){listeners.add(cb);return()=>{listeners.delete(cb);};}
};
function Fixture(){
 const [member,setMember]=useState(false),[notice,setNotice]=useState('');
 const unavailable=async()=>({success:false,error:'Демонстрационный режим'});
 const context:AuthContextType={user:member?profile:null,pendingEmail:null,sessionError:'',isLoading:false,
 authenticatedAccount:member?{id:profile.id,email:profile.email}:null,profileError:'',googleEnabled:true,retryProfile:unavailable,
 registerWithEmail:unavailable,loginWithEmail:unavailable,loginWithGoogle:unavailable,sendPasswordReset:unavailable,resendVerification:unavailable,refreshVerification:unavailable,completeAuthCallback:unavailable,changeRecoveredPassword:unavailable,updateProfile:unavailable,logout:async()=>setMember(false)};
 return <AuthContext.Provider value={context}><CosmicBackground activeTab="forum" transitionId={0} onTransitionComplete={()=>{}}/>
 <nav style={{position:'relative',zIndex:10,background:'#0b1320',padding:'14px 24px',display:'flex',gap:24,color:'#b9d3e0',font:'12px Arial',flexWrap:'wrap'}}>
 <span>ДЕМО · Тестовые данные, без записи в базу</span><button onClick={()=>{setMember(false);setNotice('');}}>Гость</button><button onClick={()=>{setMember(true);setNotice('');}}>Участник</button><span role="status">{notice}</span></nav>
 <ForumPage api={api} onOpenAuth={()=>setNotice('Для этого действия требуется вход')}/></AuthContext.Provider>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><Fixture/></React.StrictMode>);
