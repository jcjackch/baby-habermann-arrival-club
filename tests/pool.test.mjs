import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateEntry, calculatePool, berlinDate, berlinLocalToISO, validDate, candidateDates } from '../lib/pool.ts';
const id='12345678-1234-1234-1234-123456789012';
const entry=(name,date,createdAt='2026-10-09T10:00:00.000Z')=>({id:name,name,predictedDate:date,predictedHour:12,amountCents:500,createdAt});
const base={today:'2026-10-09',closed:false,arrivalDate:null,arrivalAt:null,mine:null};
test('validates dates, contributions, names and past guesses',()=>{
 assert.equal(validateEntry({id,name:'  Jack   Chen ',predictedDate:'2026-10-10',predictedHour:12,amount:5},base.today).name,'Jack Chen');
 for(const amount of [0,-1,1,1.5,6,25,100,101,'5',NaN])assert.throws(()=>validateEntry({id,name:'Jack',predictedDate:'2026-10-10',predictedHour:12,amount},base.today));
 for(const date of ['2026-10-08','2026-10-99','2026-11-07'])assert.throws(()=>validateEntry({id,name:'Jack',predictedDate:date,predictedHour:12,amount:5},base.today));
 assert.equal(validDate('2026-02-30'),false);
});
test('splits every euro exactly in half and starts empty',()=>{
 assert.equal(calculatePool({...base,entries:[]}).total,0);
 const p=calculatePool({...base,entries:[entry('a','2026-10-10'),entry('b','2026-10-12')]});
 assert.equal(p.total,1000);assert.equal(p.cake,500);assert.equal(p.prize,500);
});
test('equal-distance ties share the prize and preserve every cent',()=>{
 const p=calculatePool({...base,closed:true,arrivalDate:'2026-10-11',arrivalAt:'2026-10-11T10:00:00.000Z',entries:[entry('a','2026-10-10'),entry('b','2026-10-12'),entry('c','2026-10-10')]});
 assert.equal(p.winners.length,3);assert.equal(p.winners.reduce((n,w)=>n+w.payoutCents,0),p.prize);assert.equal(p.cake,p.prize);
});
test('exact matches beat nearby guesses and late pledges are excluded',()=>{
 const p=calculatePool({...base,closed:true,arrivalDate:'2026-10-10',arrivalAt:'2026-10-10T10:00:00.000Z',entries:[entry('a','2026-10-09'),entry('b','2026-10-10'),entry('late','2026-10-10','2026-10-10T10:00:00.000Z')]});
 assert.equal(p.total,1000);assert.equal(p.winners[0].name,'b');assert.equal(p.winners.length,1);
});
test('Berlin calendar and local birth time use the correct timezone',()=>{
 assert.equal(berlinDate(new Date('2026-10-09T23:00:00Z')),'2026-10-10');
 assert.equal(berlinLocalToISO('2026-10-09T12:30'),'2026-10-09T10:30:00.000Z');
 assert.equal(berlinLocalToISO('2026-11-01T12:30'),'2026-11-01T11:30:00.000Z');
 assert.throws(()=>berlinLocalToISO('2026-10-09T99:00'));
});

test('accepts only the four contribution choices and requires a whole arrival hour',()=>{
 for(const amount of [5,10,15,20])assert.equal(validateEntry({id,name:'Guest',predictedDate:'2026-10-20',predictedHour:23,amount},base.today).amountCents,amount*100);
 for(const predictedHour of [undefined,null,-1,24,12.5,'12',NaN])assert.throws(()=>validateEntry({id,name:'Guest',predictedDate:'2026-10-20',predictedHour,amount:5},base.today));
 assert.equal(validateEntry({id,name:'Guest',predictedDate:'2026-10-20',predictedHour:0,amount:5},base.today).predictedHour,0);
});
test('date candidates reach November 6 instead of stopping after seven days',()=>{
 const dates=candidateDates('2026-10-09');
 assert.equal(dates.length,29);assert.equal(dates[0],'2026-10-09');assert.equal(dates[13],'2026-10-22');assert.equal(dates.at(-1),'2026-11-06');
 assert.deepEqual(candidateDates('2026-11-06'),['2026-11-06']);assert.deepEqual(candidateDates('2026-11-07'),[]);
});
test('uses the guessed hour to pick the closest entry, including across midnight',()=>{
 const entries=[{...entry('early','2026-10-10'),predictedHour:9},{...entry('closer','2026-10-10'),predictedHour:12}];
 const result=calculatePool({...base,closed:true,arrivalDate:'2026-10-10',arrivalAt:'2026-10-10T10:15:00.000Z',entries});
 assert.deepEqual(result.winners.map(e=>e.name),['closer']);
 const midnight=calculatePool({...base,closed:true,arrivalDate:'2026-10-11',arrivalAt:'2026-10-10T22:15:00.000Z',entries:[{...entry('previous-day','2026-10-10'),predictedHour:23},{...entry('next-day','2026-10-11'),predictedHour:0}]});
 assert.deepEqual(midnight.winners.map(e=>e.name),['next-day']);
});
test('equidistant hour guesses tie and the half-pool payout is preserved',()=>{
 const result=calculatePool({...base,closed:true,arrivalDate:'2026-10-10',arrivalAt:'2026-10-10T10:00:00.000Z',entries:[{...entry('earlier','2026-10-10'),predictedHour:11},{...entry('later','2026-10-10'),predictedHour:13}]});
 assert.equal(result.winners.length,2);assert.equal(result.winners.reduce((sum,e)=>sum+e.payoutCents,0),result.total/2);
});
