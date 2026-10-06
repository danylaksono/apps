// Story scene definitions: narration (Bahasa Indonesia), state tweens and camera keyframes.
import {P} from './utils.js';

const FACE=P(-55,3,8,150,Math.PI-0.45,1.2);
const scenes=[
 {title:'Kubah gambut dalam satu KHG',dur:6.5,
  narr:'Ini satu Kesatuan Hidrologis Gambut (KHG) rekaan. Gambut menumpuk membentuk kubah: paling tinggi di tengah dan menurun ke arah sungai. Potongan melintang memperlihatkan yang tidak terlihat di lapangan, yaitu tinggi muka air (TMA) di dalam gambut. Garis putus-putus putih adalah batas 0,4 m di bawah permukaan: TMA tidak boleh lebih dalam dari ini (PP 57/2016).',
  start:{},tw:[{k:'cut',f:-100,to:-55,s:2.6,e:5.6}],cam:[{t:2.2,p:P(0,0,0,275,2.35,0.8)},{t:6.2,p:FACE}]},
 {title:'Kemarau: kanal menguras gambut',dur:13.5,
  narr:'Saat kemarau, hujan berhenti tetapi evapotranspirasi tetap sekitar 4 mm per hari. Kanal drainase menarik air keluar dari gambut di sekitarnya, sehingga TMA turun paling dalam di dekat kanal. Warna jingga dan merah menandai TMA yang melewati batas 0,4 m. Gambut bekas terbakar mengering lebih cepat, memunculkan titik api, dan asap mulai menyelimuti langit.',
  start:{cut:-55,et:1},tw:[{k:'color',f:0,to:1,s:0.3,e:1.8},{k:'t',f:0,to:75,s:2,e:13}],cam:[{t:2.5,p:P(-55,3,10,165,Math.PI-0.62,1.05)}]},
 {title:'Sekat kanal menahan air',dur:10,
  narr:'Sekat kanal menaikkan muka air kanal secara bertingkat, dengan beda tinggi sekitar 0,3 m antar sekat. Gambut di sekitar kanal ikut basah kembali, tetapi pengaruhnya terbatas: sekitar 200 m dari kanal, dan hanya sekitar 20 m pada gambut bekas terbakar. Area yang jauh dari kanal tetap kering, jadi sekat saja belum cukup.',
  start:{t:75,color:1,cut:-55,et:0.35},tw:[{k:'pB',f:0,to:1,s:1.5,e:9.5}],cam:[{t:2.5,p:P(-48,3,22,175,Math.PI-0.8,0.98)}]},
 {title:'Berbagi air antar kompartemen',dur:11.5,
  narr:'Kompartemen di dekat puncak kubah menyimpan surplus air di balik sekat. Saat pintu air dibuka, air mengalir menuruni lereng ke kompartemen yang defisit. Setiap minggu, model menghitung ke mana surplus paling berguna, dengan mendahulukan area yang paling berisiko terbakar.',
  start:{t:75,color:1,pB:1,et:0.35},tw:[{k:'gate',f:0,to:1,s:1.5,e:3},{k:'front',f:0,to:1,s:3,e:11}],cam:[{t:2.5,p:P(16,3,-28,150,0.95,0.86)}]},
 {title:'Pompa: menambah air saat kanal kering',dur:14,
  narr:'Pada kemarau panjang, air di balik sekat ikut habis dan sekat kehilangan fungsinya. Pompa mengambil air dari sungai, lalu pompa penguat dan embung meneruskannya ke hulu kanal, dari sekat ke sekat. Air bergerak sekitar 1,7 km per hari dan menghabiskan BBM. Satu pompa portabel hanya mampu mengimbangi penguapan sekitar 13 ha, jadi pompa disimpan untuk area yang paling berisiko.',
  start:{t:75,color:1,pB:1,gate:1,front:1,et:0.35},tw:[{k:'t',f:75,to:95,s:0.5,e:3.5},{k:'dry',f:0,to:1,s:0.8,e:3.5},{k:'pump',f:0,to:1,s:4.5,e:13}],cam:[{t:2.5,p:P(-38,3,58,165,0.65,0.92)}]},
 {title:'Strategi untuk tiap kompartemen',dur:5,
  narr:'Model memberi tiap kompartemen tindakan termurah yang mampu menutup defisitnya: operasi pintu air lebih dulu, lalu perbaikan atau pembangunan sekat, lalu pompa. Area yang tetap kering setelah semua tindakan, terutama gambut bekas terbakar, ditandai sebagai risiko tersisa dan disiapkan untuk pemadaman, misalnya dengan sumur bor.',
  start:{t:95,color:1,pB:1,gate:1,front:1,dry:1,pump:1,et:0.2},tw:[{k:'strat',f:0,to:1,s:1,e:3}],cam:[{t:2.5,p:P(0,0,0,250,2.1,0.55)}]},
 {title:'Tahun normal dan tahun El Niño',dur:16,
  narr:'Paket tindakan yang sama diuji pada dua musim kemarau. Pada tahun normal, sebagian besar KHG bertahan pada batas aman 0,4 m. Pada tahun El Niño, kemarau lebih kering dan lebih panjang, kanal di balik sekat ikut kering, dan luas area aman turun tajam meski pompa dijalankan. Sekarang giliran Anda: coba atur sendiri air di KHG ini.',
  start:{color:1,pB:1,gate:1,front:1,k:0.6,et:0.3},
  tw:[{k:'t',f:0,to:90,s:1,e:7},{k:'k',f:0.6,to:1.3,s:8.5,e:8.55},{k:'t',f:0,to:90,s:8.5,e:14.5},{k:'dry',f:0,to:1,s:12,e:14},{k:'pump',f:0,to:1,s:13.5,e:15.5}],
  cam:[{t:2.5,p:P(0,0,0,255,2.35,0.78)}]}
];

export {scenes};
