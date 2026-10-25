// Audited against @nisphysicshub history and bot-restored originals on 2026-10-10. Original bytes and names are preserved.
// Only first-quarter materials are published in Study, as requested on 2026-10-13.
// `und` means the source does not establish a language. Empty sections never imply a guessed section.
export type TelegramStudyEntry = Readonly<{
  id: string; grade: number | null; quarter: number | null; sections: readonly string[];
  language: 'ru' | 'kk' | 'en' | 'und'; kind: 'notes' | 'trial' | 'quarter' | 'preparation' | 'extra';
  role: 'tasks' | 'answers'; format: 'pdf' | 'docx'; sources: readonly number[]; names: readonly string[];
  evidence: string; path?: string; sha256?: string; bytes?: number; localUrl?: string; external?: boolean;
}>;
export const TELEGRAM_STUDY_CATALOGUE: readonly TelegramStudyEntry[] = [
  {"id":"tg-413","grade":7,"quarter":1,"sections":["7.1B"],"language":"kk","kind":"notes","role":"tasks","evidence":"Казахская версия №412.","format":"pdf","sources":[413],"names":["Physics_7_2B_Kaz.pdf"],"path":"nisphysicshub/assets/658d3f1d0df55779b032b56be2b9b968d8c1862c9d192c3aecf4f56f42b1b8cd.pdf","sha256":"658d3f1d0df55779b032b56be2b9b968d8c1862c9d192c3aecf4f56f42b1b8cd","bytes":242423},
  {"id":"tg-412","grade":7,"quarter":1,"sections":["7.1B"],"language":"ru","kind":"notes","role":"tasks","evidence":"Внутри: Механическое движение, 7 класс; текущий раздел 7.1B.","format":"pdf","sources":[412],"names":["Physics_7_2B.pdf"],"path":"nisphysicshub/assets/d8c97ff56b8a71ca2f0cff950c868b83439407cea91ea50d7424066bb093d7b5.pdf","sha256":"d8c97ff56b8a71ca2f0cff950c868b83439407cea91ea50d7424066bb093d7b5","bytes":239706},
  {"id":"tg-409","grade":7,"quarter":1,"sections":["7.1B"],"language":"kk","kind":"trial","role":"tasks","evidence":"Механическое движение: цели 7.2.1.*; старое имя 7.2B исправлено по содержимому.","format":"docx","sources":[409],"names":["Trial SAU 7.2B Kaz.docx"],"path":"nisphysicshub/assets/9da9a5bc973a753a7cdd5f89265bbed161d8de652f8cc4eb1542eba569e7b5bc.docx","sha256":"9da9a5bc973a753a7cdd5f89265bbed161d8de652f8cc4eb1542eba569e7b5bc","bytes":92889},
  {"id":"tg-410","grade":7,"quarter":1,"sections":["7.1B"],"language":"ru","kind":"trial","role":"tasks","evidence":"Русская версия №409: механическое движение.","format":"docx","sources":[410],"names":["Trial SAU 7.2B Rus.docx"],"path":"nisphysicshub/assets/b983715fd745669d8d52adc196817e510c3af125721f14be8b02d146174d9fc5.docx","sha256":"b983715fd745669d8d52adc196817e510c3af125721f14be8b02d146174d9fc5","bytes":93496},
  {"id":"tg-83","grade":8,"quarter":1,"sections":[],"language":"kk","kind":"quarter","role":"tasks","evidence":"Подпись: 8 сынып ТЖБ-1 (жалғасы); продолжение казахского СОЧ.","format":"pdf","sources":[83],"names":["Суреттердегі_үдерсітерге_сәйкес_жылу_беру_түрін_жазыңыз_pdf.pdf"],"path":"nisphysicshub/assets/0a740b358195aa4fe92c76e8b9484efbf5d1f6935f9747e5e4bbb6c0f0aea49a.pdf","sha256":"0a740b358195aa4fe92c76e8b9484efbf5d1f6935f9747e5e4bbb6c0f0aea49a","bytes":967017},
  {"id":"tg-95","grade":8,"quarter":1,"sections":[],"language":"kk","kind":"quarter","role":"tasks","evidence":"Навигация №3/153 и подпись №105: СОЧ 8 класс, 1 четверть, казахский.","format":"pdf","sources":[95],"names":["8в.pdf"],"path":"nisphysicshub/assets/f4491892ad2ddc5b0104e686e3f4047233dc61cb55b6fd5803c767afacaad531.pdf","sha256":"f4491892ad2ddc5b0104e686e3f4047233dc61cb55b6fd5803c767afacaad531","bytes":643510},
  {"id":"tg-96","grade":8,"quarter":1,"sections":[],"language":"kk","kind":"quarter","role":"tasks","evidence":"Навигация №3/153 и подпись №105: СОЧ 8 класс, 1 четверть, казахский.","format":"pdf","sources":[96],"names":["5в.pdf"],"path":"nisphysicshub/assets/86928f831156a74e90c1b28bafaf9541b1550da4bf68f03567545d3374fcf06f.pdf","sha256":"86928f831156a74e90c1b28bafaf9541b1550da4bf68f03567545d3374fcf06f","bytes":607744},
  {"id":"tg-97","grade":8,"quarter":1,"sections":[],"language":"kk","kind":"quarter","role":"tasks","evidence":"Навигация №3/153 и подпись №105: СОЧ 8 класс, 1 четверть, казахский.","format":"pdf","sources":[97],"names":["10в.pdf"],"path":"nisphysicshub/assets/3b9a5dc43b7d494e16c5a7c4ea6f7f6ea79409912b2bd2e9de1259fcc1f795a1.pdf","sha256":"3b9a5dc43b7d494e16c5a7c4ea6f7f6ea79409912b2bd2e9de1259fcc1f795a1","bytes":629595},
  {"id":"tg-419","grade":8,"quarter":1,"sections":[],"language":"kk","kind":"quarter","role":"tasks","evidence":"Внутри: 8 класс, 1 четверть; варианты 9 и 1.","format":"pdf","sources":[98,419],"names":["9в.pdf"],"path":"nisphysicshub/assets/44784fe45a2e705759941569d6f959e5609fa1181bf23975cf5ec5f92636a4b2.pdf","sha256":"44784fe45a2e705759941569d6f959e5609fa1181bf23975cf5ec5f92636a4b2","bytes":401751},
  {"id":"tg-420","grade":8,"quarter":1,"sections":[],"language":"kk","kind":"quarter","role":"tasks","evidence":"Внутри: 8 класс, 1 четверть; варианты 9 и 1.","format":"pdf","sources":[99,420],"names":["1 в.pdf"],"path":"nisphysicshub/assets/edea91c4396cf31a24bfca37e71384b7ef6f72b0841612b885cb440c3728709d.pdf","sha256":"edea91c4396cf31a24bfca37e71384b7ef6f72b0841612b885cb440c3728709d","bytes":951996},
  {"id":"tg-100","grade":8,"quarter":1,"sections":[],"language":"kk","kind":"quarter","role":"tasks","evidence":"Навигация №3/153 и подпись №105: СОЧ 8 класс, 1 четверть, казахский.","format":"pdf","sources":[100],"names":["6в.pdf"],"path":"nisphysicshub/assets/75c604fdc4c77c3e7d7038812b4b0d25555f8f42d9cb803f270712e8ab5c146b.pdf","sha256":"75c604fdc4c77c3e7d7038812b4b0d25555f8f42d9cb803f270712e8ab5c146b","bytes":502251},
  {"id":"tg-101","grade":8,"quarter":1,"sections":[],"language":"kk","kind":"quarter","role":"tasks","evidence":"Навигация №3/153 и подпись №105: СОЧ 8 класс, 1 четверть, казахский.","format":"pdf","sources":[101],"names":["7в.pdf"],"path":"nisphysicshub/assets/4b37053cfea6b08bce661909f2a82771ebb03083edc5119e980a7cc67a610785.pdf","sha256":"4b37053cfea6b08bce661909f2a82771ebb03083edc5119e980a7cc67a610785","bytes":1041133},
  {"id":"tg-102","grade":8,"quarter":1,"sections":[],"language":"kk","kind":"quarter","role":"tasks","evidence":"Навигация №3/153 и подпись №105: СОЧ 8 класс, 1 четверть, казахский.","format":"pdf","sources":[102],"names":["4в.pdf"],"path":"nisphysicshub/assets/8fd9ba18628d37b00479efdd1e3f011c53cc871637d683acd6abff075d2fed21.pdf","sha256":"8fd9ba18628d37b00479efdd1e3f011c53cc871637d683acd6abff075d2fed21","bytes":408165},
  {"id":"tg-103","grade":8,"quarter":1,"sections":[],"language":"kk","kind":"quarter","role":"tasks","evidence":"Навигация №3/153 и подпись №105: СОЧ 8 класс, 1 четверть, казахский.","format":"pdf","sources":[103],"names":["3 в.pdf"],"path":"nisphysicshub/assets/63ccd8040390c63076c955897c916845a1338ad1b1d73199ef433d90af6217fd.pdf","sha256":"63ccd8040390c63076c955897c916845a1338ad1b1d73199ef433d90af6217fd","bytes":1018147},
  {"id":"tg-104","grade":8,"quarter":1,"sections":[],"language":"kk","kind":"quarter","role":"tasks","evidence":"Навигация №3/153 и подпись №105: СОЧ 8 класс, 1 четверть, казахский.","format":"pdf","sources":[104],"names":["2в.pdf"],"path":"nisphysicshub/assets/f0fc1d52866c230d65b8ce3990c2770bd574e233e4a54740ed1a68ce25e611aa.pdf","sha256":"f0fc1d52866c230d65b8ce3990c2770bd574e233e4a54740ed1a68ce25e611aa","bytes":679783},
  {"id":"tg-42","grade":8,"quarter":1,"sections":[],"language":"ru","kind":"quarter","role":"tasks","evidence":"Навигация канала №3/152: СОЧ 8 класс, 1 четверть, русский.","format":"pdf","sources":[42],"names":["соч 1 пробный вариант.pdf"],"path":"nisphysicshub/assets/2af502b09365d2299d806b422fb9a2c879c77ec6ecd1b536a611173b4a717f9f.pdf","sha256":"2af502b09365d2299d806b422fb9a2c879c77ec6ecd1b536a611173b4a717f9f","bytes":473749},
  {"id":"tg-43","grade":8,"quarter":1,"sections":[],"language":"ru","kind":"quarter","role":"tasks","evidence":"Навигация канала №3/152: СОЧ 8 класс, 1 четверть, русский.","format":"pdf","sources":[43],"names":["соч 2 пробный вариант.pdf"],"path":"nisphysicshub/assets/ddab3c2f4304ffbfb36fe58d961564b54fc172e9e7856fee544c082267c29c80.pdf","sha256":"ddab3c2f4304ffbfb36fe58d961564b54fc172e9e7856fee544c082267c29c80","bytes":430283},
  {"id":"tg-44","grade":8,"quarter":1,"sections":[],"language":"ru","kind":"quarter","role":"tasks","evidence":"Навигация канала №3/152: СОЧ 8 класс, 1 четверть, русский.","format":"docx","sources":[44],"names":["соч 3 пробный вариант.docx"],"path":"nisphysicshub/assets/8ee485d451ee93f7f2bdc1a4df1b5e8e36935ad9b285d7c2acd7e5c8dfb6593f.docx","sha256":"8ee485d451ee93f7f2bdc1a4df1b5e8e36935ad9b285d7c2acd7e5c8dfb6593f","bytes":660675},
  {"id":"tg-45","grade":8,"quarter":1,"sections":[],"language":"ru","kind":"quarter","role":"tasks","evidence":"Навигация канала №3/152: СОЧ 8 класс, 1 четверть, русский.","format":"pdf","sources":[45],"names":["соч 4 пробный вариант.pdf"],"path":"nisphysicshub/assets/5cf79f443b539168172e968bcbe3ce55548b39e4f39a0db60d21ca3cae2905c6.pdf","sha256":"5cf79f443b539168172e968bcbe3ce55548b39e4f39a0db60d21ca3cae2905c6","bytes":608268},
  {"id":"tg-46","grade":8,"quarter":1,"sections":[],"language":"ru","kind":"quarter","role":"tasks","evidence":"Навигация канала №3/152: СОЧ 8 класс, 1 четверть, русский.","format":"pdf","sources":[46],"names":["соч 5 пробный вариант.pdf"],"path":"nisphysicshub/assets/cc3bd1cc1d123c2edd32280e552babe618900a6845a74a2df5ef2b170a0d68b9.pdf","sha256":"cc3bd1cc1d123c2edd32280e552babe618900a6845a74a2df5ef2b170a0d68b9","bytes":847389},
  {"id":"tg-417","grade":8,"quarter":1,"sections":[],"language":"ru","kind":"quarter","role":"tasks","evidence":"Три варианта СОЧ за 1 четверть; совпадает с локальным оригиналом.","format":"docx","sources":[84,417],"names":["СОЧи 8 кл 1 чет.docx"],"path":"nisphysicshub/assets/cef74cd014f0d81c5222b18ec8c5280d03e0e86845f3d0aaeeb05aaa675eec1f.docx","sha256":"cef74cd014f0d81c5222b18ec8c5280d03e0e86845f3d0aaeeb05aaa675eec1f","bytes":2287745,"localUrl":"/study/8/1/quarter/soch-ru.docx"},
  {"id":"tg-388","grade":8,"quarter":1,"sections":["8.1A"],"language":"kk","kind":"trial","role":"tasks","evidence":"Казахская версия №387, существующий локальный оригинал.","format":"docx","sources":[388],"names":["Trial SAU 8.1A Kaz.docx"],"path":"nisphysicshub/assets/028f51f7406b590d8088aa81b2b4900d3f6699d669f4afae70a1ba66fbcd3e46.docx","sha256":"028f51f7406b590d8088aa81b2b4900d3f6699d669f4afae70a1ba66fbcd3e46","bytes":334609,"localUrl":"/study/8/1/a/sau-kk.docx"},
  {"id":"tg-428","grade":8,"quarter":1,"sections":["8.1B"],"language":"kk","kind":"trial","role":"answers","evidence":"Отдельные ответы к №429.","format":"docx","sources":[428],"names":["8.1B_SAU-KAZ_answers.docx"],"path":"nisphysicshub/assets/8fb05dba9744ad9c43f3e2974f287fa3207a01e1e8fb2ca4b747a278d2d9efb9.docx","sha256":"8fb05dba9744ad9c43f3e2974f287fa3207a01e1e8fb2ca4b747a278d2d9efb9","bytes":9248,"localUrl":"/study/8/1/b/answers-kk.docx"},
  {"id":"tg-429","grade":8,"quarter":1,"sections":["8.1B"],"language":"kk","kind":"trial","role":"tasks","evidence":"8.1B, количество теплоты; существующий локальный оригинал.","format":"docx","sources":[429],"names":["8.1B_SAU-KAZ.docx"],"path":"nisphysicshub/assets/3ecd5c4f925a77de5e33766c3a4548ce27191cfe1033211adc9f7edb9c76035a.docx","sha256":"3ecd5c4f925a77de5e33766c3a4548ce27191cfe1033211adc9f7edb9c76035a","bytes":9484,"localUrl":"/study/8/1/b/sau-kk.docx"},
  {"id":"tg-387","grade":8,"quarter":1,"sections":["8.1A"],"language":"ru","kind":"trial","role":"tasks","evidence":"Раздел 8.1A указан внутри; сохранён ранее добавленный локальный оригинал.","format":"docx","sources":[387],"names":["Trial SAU 8.1A Rus.docx"],"path":"nisphysicshub/assets/bd25cc89551a7df91a48f8cdd343fd62e22a9d8061b8d4c484e4a2a69765081b.docx","sha256":"bd25cc89551a7df91a48f8cdd343fd62e22a9d8061b8d4c484e4a2a69765081b","bytes":336073,"localUrl":"/study/8/1/a/sau-ru.docx"},
  {"id":"tg-430","grade":8,"quarter":1,"sections":["8.1B"],"language":"ru","kind":"trial","role":"answers","evidence":"Отдельные ответы к №431.","format":"docx","sources":[430],"names":["8.1B_SAU-RUS_answers.docx"],"path":"nisphysicshub/assets/8244e2ce1a62949c32ca085df741d8f0fb220208d14ce7dc106df3a5f88016af.docx","sha256":"8244e2ce1a62949c32ca085df741d8f0fb220208d14ce7dc106df3a5f88016af","bytes":9291,"localUrl":"/study/8/1/b/answers-ru.docx"},
  {"id":"tg-431","grade":8,"quarter":1,"sections":["8.1B"],"language":"ru","kind":"trial","role":"tasks","evidence":"Русская версия №429, существующий локальный оригинал.","format":"docx","sources":[431],"names":["8.1B_SAU-RUS.docx"],"path":"nisphysicshub/assets/98d3bf2c4a6ecffda7cc0d2aaafb1d75ce72d3734b8497668752135273d2302f.docx","sha256":"98d3bf2c4a6ecffda7cc0d2aaafb1d75ce72d3734b8497668752135273d2302f","bytes":9586,"localUrl":"/study/8/1/b/sau-ru.docx"},
  {"id":"tg-407","grade":9,"quarter":1,"sections":["9.1A","9.1B"],"language":"kk","kind":"notes","role":"tasks","evidence":"Казахская версия №405, оба раздела.","format":"pdf","sources":[407],"names":["Physics_9_1A_Kaz.pdf"],"path":"nisphysicshub/assets/e2be5bb2a3c2d07f2eb5ae4beca0036c652ea95c3a61232277239a2c6577a4ce.pdf","sha256":"e2be5bb2a3c2d07f2eb5ae4beca0036c652ea95c3a61232277239a2c6577a4ce","bytes":308662},
  {"id":"tg-405","grade":9,"quarter":1,"sections":["9.1A","9.1B"],"language":"ru","kind":"notes","role":"tasks","evidence":"Внутри: Векторы и Кинематика, 9 класс, оба раздела 1 четверти.","format":"pdf","sources":[405],"names":["Physics_9_1_A.pdf"],"path":"nisphysicshub/assets/9c8729b27c05c251e7bd27760c2896ce0838ae2f1ea9de4968604ed24d652fea.pdf","sha256":"9c8729b27c05c251e7bd27760c2896ce0838ae2f1ea9de4968604ed24d652fea","bytes":295533},
  {"id":"tg-75","grade":9,"quarter":1,"sections":[],"language":"kk","kind":"quarter","role":"tasks","evidence":"Навигация №3: СОЧ 9 класс, 1 четверть, казахский.","format":"docx","sources":[75],"names":["Большой соч 9.1.docx"],"path":"nisphysicshub/assets/b1e292a067db29c4d187984fb42c6ef4a65384d3b1eb00069d395f855b45a460.docx","sha256":"b1e292a067db29c4d187984fb42c6ef4a65384d3b1eb00069d395f855b45a460","bytes":252526},
  {"id":"tg-415","grade":9,"quarter":1,"sections":[],"language":"ru","kind":"quarter","role":"tasks","evidence":"Внутри: СОЧ за 1 четверть; имя и подпись: 9 класс.","format":"docx","sources":[80,415],"names":["СОЧ 1 9 кл 2024-2025 (1).docx"],"path":"nisphysicshub/assets/ea3cb0a5f4a662a7ebc5e1bf3bc83a0ab260302a08ddb3da53919f46aa8244a1.docx","sha256":"ea3cb0a5f4a662a7ebc5e1bf3bc83a0ab260302a08ddb3da53919f46aa8244a1","bytes":1470273},
  {"id":"tg-399","grade":9,"quarter":1,"sections":["9.1A","9.1B"],"language":"kk","kind":"trial","role":"tasks","evidence":"Казахская версия №398: векторы и кинематика.","format":"docx","sources":[399],"names":["Trial SAU 9.1A Kaz.docx"],"path":"nisphysicshub/assets/6e41db3ceaf455fd4b83398baca957302946c5417c317253788f7ff2a0e78257.docx","sha256":"6e41db3ceaf455fd4b83398baca957302946c5417c317253788f7ff2a0e78257","bytes":32077},
  {"id":"tg-425","grade":9,"quarter":1,"sections":["9.1B"],"language":"kk","kind":"trial","role":"tasks","evidence":"Казахская версия №422.","format":"docx","sources":[425],"names":["СОР Кинематика 9 класс_KZ.docx"],"path":"nisphysicshub/assets/20bd0fb17fc3b5cdce2b4c659ba99a59af7ed8d57d2da001f51b7cd858bf7cd7.docx","sha256":"20bd0fb17fc3b5cdce2b4c659ba99a59af7ed8d57d2da001f51b7cd858bf7cd7","bytes":420335},
  {"id":"tg-426","grade":9,"quarter":1,"sections":["9.1C"],"language":"kk","kind":"trial","role":"tasks","evidence":"Внутри: равномерное движение по окружности, угловая скорость, центростремительное ускорение.","format":"docx","sources":[426],"names":["Trial SAU 9.1C KZ.docx"],"path":"nisphysicshub/assets/eebb5d156422ea2aa0b728ffec3c8398c5ec9a63a48906d60b3060578510f9ef.docx","sha256":"eebb5d156422ea2aa0b728ffec3c8398c5ec9a63a48906d60b3060578510f9ef","bytes":52741},
  {"id":"tg-398","grade":9,"quarter":1,"sections":["9.1A","9.1B"],"language":"ru","kind":"trial","role":"tasks","evidence":"Векторы и кинематика: в документе есть оба набора целей и задания, общий файл для A/B.","format":"docx","sources":[398],"names":["Trial SAU 9.1A Rus.docx"],"path":"nisphysicshub/assets/ac17871650ad7d18e69bebe1d55d801f01d5c798529d1ad440de1fe8010f196e.docx","sha256":"ac17871650ad7d18e69bebe1d55d801f01d5c798529d1ad440de1fe8010f196e","bytes":90825},
  {"id":"tg-422","grade":9,"quarter":1,"sections":["9.1B"],"language":"ru","kind":"trial","role":"tasks","evidence":"Задания по кинематике, карта и графики движения, свободное падение.","format":"docx","sources":[422],"names":["СОР Кинематика 9 класс.docx"],"path":"nisphysicshub/assets/7acf28ed328b2a5754d1df1a49174adb701bc4a5d1a12ba4e8c06806f792d5ca.docx","sha256":"7acf28ed328b2a5754d1df1a49174adb701bc4a5d1a12ba4e8c06806f792d5ca","bytes":436430},
  {"id":"tg-427","grade":9,"quarter":1,"sections":["9.1C"],"language":"ru","kind":"trial","role":"tasks","evidence":"Русская версия №426; кириллическая С в имени нормализована в латинскую C.","format":"docx","sources":[427],"names":["Trial SAU 9.1С Rus.docx"],"path":"nisphysicshub/assets/e90d30f5190dd51ff826adcfcd1297612c01f07001ae7c12cc346bd769b344e0.docx","sha256":"e90d30f5190dd51ff826adcfcd1297612c01f07001ae7c12cc346bd769b344e0","bytes":70896},
  {"id":"tg-68","grade":9,"quarter":1,"sections":[],"language":"und","kind":"trial","role":"tasks","evidence":"Навигация №3: СОР 9 класс, 1 четверть. Раздел и язык документом не подтверждены.","format":"docx","sources":[68],"names":["Пробный сор.docx"],"path":"nisphysicshub/assets/51ebba0a6f47f8f97b0c713c3a13fbd3e2fda4be36a04312f5bcd7567d04c6e7.docx","sha256":"51ebba0a6f47f8f97b0c713c3a13fbd3e2fda4be36a04312f5bcd7567d04c6e7","bytes":69522},
  {"id":"tg-424","grade":10,"quarter":1,"sections":["10.1B"],"language":"kk","kind":"trial","role":"tasks","evidence":"Казахская версия №423, гравитация.","format":"docx","sources":[424],"names":["Trial SAU 10.2 KAZ-2.docx"],"path":"nisphysicshub/assets/63b087c4c5a6e00ff11682333a8fffcaeeb8e07ab80c421945e61bdcee504215.docx","sha256":"63b087c4c5a6e00ff11682333a8fffcaeeb8e07ab80c421945e61bdcee504215","bytes":9949},
  {"id":"tg-423","grade":10,"quarter":1,"sections":["10.1B"],"language":"ru","kind":"trial","role":"tasks","evidence":"Внутри: гравитационное поле; по актуальной программе 10.1B, старое имя 10.2.","format":"docx","sources":[423],"names":["Trial SAU 10.2 RUS-2.docx"],"path":"nisphysicshub/assets/5e32219d9dafac3b9388736b8f4bb5eb507b15d29a3e754b55fe598afd19b2bb.docx","sha256":"5e32219d9dafac3b9388736b8f4bb5eb507b15d29a3e754b55fe598afd19b2bb","bytes":10328},
  {"id":"tg-401","grade":11,"quarter":1,"sections":["11.1B"],"language":"en","kind":"notes","role":"tasks","evidence":"Внутри: UNIT 1B Kinematics, Grade 11; старое имя 11_2B исправлено по содержимому.","format":"pdf","sources":[401],"names":["Physics_11_2B.pdf"],"path":"nisphysicshub/assets/b3684dd209929e632844e6ce1cf394d90b30816959d3e72b063e4d636466cba1.pdf","sha256":"b3684dd209929e632844e6ce1cf394d90b30816959d3e72b063e4d636466cba1","bytes":280999},
];

export const TELEGRAM_STUDY_EXCLUDED = [
  {
    "messageId": 9,
    "name": "ГольдфарбМеханика,_Электричество,_Оптика.pdf",
    "reason": "Задачники/книги по нескольким классам, не конспекты и не пробные СОР/СОЧ."
  },
  {
    "messageId": 9,
    "name": "Иродов(Динамика).pdf",
    "reason": "Задачники/книги по нескольким классам, не конспекты и не пробные СОР/СОЧ."
  },
  {
    "messageId": 9,
    "name": "Оптика +.pdf",
    "reason": "Задачники/книги по нескольким классам, не конспекты и не пробные СОР/СОЧ."
  },
  {
    "messageId": 9,
    "name": "СавченкоМеханика,_Электричество,_Оптика.pdf",
    "reason": "Задачники/книги по нескольким классам, не конспекты и не пробные СОР/СОЧ."
  },
  {
    "messageId": 9,
    "name": "1001(Механика, Колебания).pdf",
    "reason": "Задачники/книги по нескольким классам, не конспекты и не пробные СОР/СОЧ."
  },
  {
    "messageId": 9,
    "name": "3800(Механика, Колебания).pdf",
    "reason": "Задачники/книги по нескольким классам, не конспекты и не пробные СОР/СОЧ."
  },
  {
    "messageId": 15,
    "name": "Кузнецов_Оптика.pdf",
    "reason": "Книга по оптике, не конспект/пробный вариант."
  },
  {
    "messageId": 110,
    "name": "Spring_pendulum.pdf",
    "reason": "Решение олимпиадной задачи, без класса/четверти."
  },
  {
    "messageId": 215,
    "name": "oblast_2025_2026_problem_3 (3).pdf",
    "reason": "Решение задачи областной олимпиады, не конспект/пробный вариант."
  },
  {
    "messageId": 220,
    "name": "oblast_problem1.pdf",
    "reason": "Решение задачи областной олимпиады о спутнике, не конспект/пробный вариант."
  }
] as const;
