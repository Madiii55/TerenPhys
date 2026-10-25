export function Motion7Lesson({ language }: { language: 'ru' | 'kk' }) {
  const tableLabel = language === 'kk' ? 'Конспект кестесі. Жылжыту үшін бағыттауыш пернелерді пайдаланыңыз.' : 'Таблица конспекта. Для прокрутки используйте клавиши со стрелками.';
  if (language === 'kk') {
    return (
      <>
        <section>
          <h3>Механикалық қозғалыс</h3>
          <p><strong>Механикалық қозғалыс</strong> — дененің немесе дене бөліктерінің уақыт өте келе басқа денеге қатысты орнының өзгеруі.</p>
          <p>Қарапайым айтқанда, дененің орны уақыт өте өзгерсе, дене қозғалады. Бірақ мұнда маңызды бір жайт бар: қозғалыс әрқашан белгілі бір денеге қатысты қарастырылады.</p>
          <p>Мысалы, автомобиль жолға қатысты қозғалады, адам Жерге қатысты жүреді, ал пойыз станцияға қатысты қозғалады.</p>
        </section>
        <section>
          <h3>Санақ денесі</h3>
          <p><strong>Санақ денесі</strong> — басқа дененің қозғалысы соған қатысты қарастырылатын дене.</p>
          <p>Қозғалып келе жатқан пойызда отырған жолаушыны қарастырайық.</p>
          <figure>
            <img src="/study/lessons/motion7-kk-reference.png" alt="Қозғалып келе жатқан пойыздағы жолаушы және Жер: пойыздың қозғалыс бағыты оңға көрсетілген" loading="lazy" />
            <figcaption>Жолаушы вагонға қатысты тыныштықта, ал Жерге қатысты пойызбен бірге қозғалады.</figcaption>
          </figure>
          <p>Вагонға қатысты жолаушы тыныштық күйінде. Ал Жерге қатысты ол пойызбен бірге қозғалады.</p>
          <p>Бір дене бір денеге қатысты тыныштықта болып, екінші денеге қатысты бір уақытта қозғала алады. Сондықтан жай ғана «дене қозғалады» деуге болмайды. «Ол неге қатысты қозғалады?» деп нақтылау керек.</p>
        </section>
        <section>
          <h3>Материалдық нүкте</h3>
          <p><strong>Материалдық нүкте</strong> — берілген есепте өлшемдерін елемеуге болатын дене.</p>
          <p>Мысалы, ұшақ бір қаладан екінші қалаға ұшып барады. Қалалар арасындағы қашықтық ұшақтың өлшемдерінен әлдеқайда үлкен, сондықтан ұшақты материалдық нүкте деп қарастыруға болады.</p>
          <p>Ал автомобиль гаражға кіріп жатқанда, оның өлшемдері маңызды болады. Мұндай есепте автомобильді материалдық нүкте деп қарастыруға болмайды.</p>
        </section>
        <section>
          <h3>Траектория</h3>
          <p><strong>Траектория</strong> — дене қозғалып өтетін сызық.</p>
          <p>Траектория мынадай болуы мүмкін:</p>
          <div className="study-lesson-table" tabIndex={0} role="region" aria-label={tableLabel}>
            <table>
              <thead><tr><th scope="col">Түрі</th><th scope="col">Түсіндірмесі</th></tr></thead>
              <tbody>
                <tr><th scope="row">Түзусызықты</th><td>Дене түзу сызық бойымен қозғалады</td></tr>
                <tr><th scope="row">Қисықсызықты</th><td>Дене қисық сызық бойымен қозғалады</td></tr>
              </tbody>
            </table>
          </div>
          <figure>
            <img src="/study/lessons/motion7-kk-trajectories.png" alt="Сол жақта түзу бағытталған сызық, оң жақта қисық бағытталған сызық" loading="lazy" />
            <figcaption>Түзусызықты және қисықсызықты қозғалыс.</figcaption>
          </figure>
        </section>
        <section>
          <h3>Жол</h3>
          <p><strong>Жол</strong> — дене қозғалған траекторияның ұзындығы.</p>
          <p>Белгіленуі:</p>
          <p className="study-lesson-equation">s</p>
          <p>SI жүйесіндегі өлшем бірлігі:</p>
          <p className="study-lesson-equation">[s] = м</p>
          <p>Жол дененің <strong>барлығы қанша қашықтық жүргенін</strong> көрсетеді.</p>
          <ul>
            <li>Жолдың бағыты болмайды.</li>
            <li>Жол скаляр шама болып табылады.</li>
            <li>Жол теріс мән қабылдамайды.</li>
          </ul>
          <p>Мысалы, оқушы үйден мектепке дейін 200 м, содан кейін үйіне қайтып тағы 200 м жүрді. Жалпы жол:</p>
          <p className="study-lesson-equation">s = 200 + 200</p>
          <p className="study-lesson-equation">s = 400 м</p>
        </section>
        <section>
          <h3>Орын ауыстыру</h3>
          <p><strong>Орын ауыстыру</strong> — дененің бастапқы орнынан соңғы орнына дейін жүргізілген бағытталған кесінді.</p>
          <p>Жолдан айырмашылығы, орын ауыстырудың бағыты болады.</p>
          <figure>
            <img src="/study/lessons/motion7-kk-displacement.png" alt="Бастапқы және соңғы нүкте арасындағы қисық траектория және оларды тікелей қосатын қызыл орын ауыстыру көрсеткісі" loading="lazy" />
            <figcaption>Жол бүкіл траектория бойымен есептеледі. Орын ауыстыру бастапқы және соңғы нүктелерді тікелей бағытталған кесіндімен қосады.</figcaption>
          </figure>
        </section>
        <section>
          <h3>Жол және орын ауыстыру</h3>
          <div className="study-lesson-table" tabIndex={0} role="region" aria-label={tableLabel}>
            <table>
              <thead><tr><th scope="col">Жол</th><th scope="col">Орын ауыстыру</th></tr></thead>
              <tbody>
                <tr><td>Бүкіл траекторияның ұзындығы</td><td>Бастапқы және соңғы орындарды қосады</td></tr>
                <tr><td>Бағыты жоқ</td><td>Бағыты бар</td></tr>
                <tr><td>Скаляр шама</td><td>Векторлық шама</td></tr>
                <tr><td>Теріс мән қабылдамайды</td><td>Нөлге тең болуы мүмкін</td></tr>
              </tbody>
            </table>
          </div>
          <p>Мысалы, оқушы үйінен шығып, мектепке барып, кейін қайтадан үйіне оралса, оның жүрген жолы:</p>
          <p className="study-lesson-equation">s &gt; 0</p>
          <p>Ал орын ауыстыруы:</p>
          <p className="study-lesson-equation">S = 0</p>
          <p>Себебі соңғы нүкте бастапқы нүктемен сәйкес келеді.</p>
        </section>
        <section>
          <h3>Мысал: құлап жатқан доп</h3>
          <p>Доп 5 м биіктіктен құлайды, содан кейін жоғары қарай 2.5 м биіктікке серпіледі.</p>
          <p>Жол:</p>
          <p className="study-lesson-equation">s = 5 + 2.5</p>
          <p className="study-lesson-equation">s = 7.5 м</p>
          <p>Орын ауыстыру:</p>
          <p className="study-lesson-equation">S = 5 − 2.5</p>
          <p className="study-lesson-equation">S = 2.5 м төмен</p>
          <p>Бұл мысалдан анық көрінеді:</p>
          <p className="study-lesson-equation">жол ≠ орын ауыстыру</p>
        </section>
        <section>
          <h3>Жылдамдық</h3>
          <p><strong>Жылдамдық</strong> — дененің қозғалу шапшаңдығын көрсететін физикалық шама.</p>
          <p>Бірқалыпты қозғалыс үшін:</p>
          <p className="study-lesson-equation">v = s / t</p>
          <p>Мұндағы:</p>
          <ul><li>v — жылдамдық;</li><li>s — жүрілген жол;</li><li>t — қозғалыс уақыты.</li></ul>
          <p>SI жүйесіндегі жылдамдықтың өлшем бірлігі:</p>
          <p className="study-lesson-equation">[v] = м/с</p>
          <p>Яғни жылдамдық дененің бірлік уақытта қандай жол жүретінін көрсетеді.</p>
          <p>Мысалы:</p>
          <p className="study-lesson-equation">v = 5 м/с</p>
          <p>Бұл бірқалыпты қозғалыс кезінде дене әр секунд сайын 5 м жол жүретінін білдіреді.</p>
        </section>
        <section>
          <h3>Жол, жылдамдық және уақыт формулалары</h3>
          <p>Негізгі формула:</p>
          <p className="study-lesson-equation">v = s / t</p>
          <p>Осыдан жолды табамыз:</p>
          <p className="study-lesson-equation">s = vt</p>
          <p>Ал уақытты:</p>
          <p className="study-lesson-equation">t = s / v</p>
          <p className="study-lesson-equation">v = s / t; s = vt; t = s / v</p>
        </section>
        <section>
          <h3>Орташа жылдамдық</h3>
          <p>Бірқалыпсыз қозғалыста дененің жылдамдығы өзгеруі мүмкін. Сондықтан орташа жылдамдықты қолдану ыңғайлы.</p>
          <p><strong>Орташа жылдамдық</strong> — барлық жүрілген жолдың барлық қозғалыс уақытына қатынасы.</p>
          <p className="study-lesson-equation">v<sub>орт</sub> = s<sub>жалпы</sub> / t<sub>жалпы</sub></p>
          <p>Егер қозғалыс бірнеше бөліктен тұрса:</p>
          <p className="study-lesson-equation">s<sub>жалпы</sub> = s<sub>1</sub> + s<sub>2</sub> + s<sub>3</sub> + …</p>
          <p>Және:</p>
          <p className="study-lesson-equation">t<sub>жалпы</sub> = t<sub>1</sub> + t<sub>2</sub> + t<sub>3</sub> + …</p>
          <p>Осыдан кейін:</p>
          <p className="study-lesson-equation">v<sub>орт</sub> = (s<sub>1</sub> + s<sub>2</sub> + s<sub>3</sub> + …) / (t<sub>1</sub> + t<sub>2</sub> + t<sub>3</sub> + …)</p>
          <p>Жалпы жағдайда орташа жылдамдықты бірнеше жылдамдықты жай ғана қосып, олардың санына бөлу арқылы табуға болмайды. Қозғалыс бөліктерінің уақыттары әртүрлі болса, бұл тәсіл дұрыс нәтиже бермеуі мүмкін. Әр бөлікте жылдамдық тұрақты болып, бөліктердің уақыттары бірдей болғанда, жылдамдықтардың арифметикалық ортасын қолдануға болады. Жалпы тәсіл — <strong>барлық жолды</strong> <strong>барлық уақытқа</strong> бөлу.</p>
        </section>
        <section>
          <h3>Орташа жылдамдыққа мысал</h3>
          <p>Автобус 1.2 км жолды 5 мин уақытта жүрді. Шамаларды SI жүйесіне ауыстырамыз:</p>
          <p className="study-lesson-equation">1.2 км = 1200 м</p>
          <p className="study-lesson-equation">5 мин = 300 с</p>
          <p>Қолданамыз:</p>
          <p className="study-lesson-equation">v<sub>орт</sub> = s / t</p>
          <p>Аламыз:</p>
          <p className="study-lesson-equation">v<sub>орт</sub> = 1200 / 300</p>
          <p className="study-lesson-equation">v<sub>орт</sub> = 4 м/с</p>
        </section>
        <section>
          <h3>км/сағ-ты м/с-қа айналдыру</h3>
          <p>Себебі:</p>
          <p className="study-lesson-equation">1 км = 1000 м</p>
          <p>Және:</p>
          <p className="study-lesson-equation">1 сағ = 3600 с</p>
          <p>Онда:</p>
          <p className="study-lesson-equation">1 км/сағ = (1000 / 3600) м/с</p>
          <p>Мысалы:</p>
          <p className="study-lesson-equation">36 км/сағ = (36 · 1000) / 3600</p>
          <p className="study-lesson-equation">36 км/сағ = 10 м/с</p>
          <div className="study-lesson-table" tabIndex={0} role="region" aria-label={tableLabel}>
            <table>
              <thead><tr><th scope="col">км/сағ</th><th scope="col">м/с</th></tr></thead>
              <tbody><tr><td>36</td><td>10</td></tr><tr><td>72</td><td>20</td></tr><tr><td>108</td><td>30</td></tr></tbody>
            </table>
          </div>
        </section>
        <section>
          <h3>Бірқалыпты қозғалыс</h3>
          <p><strong>Бірқалыпты қозғалыс</strong> — дене бірдей уақыт аралықтарында бірдей жол жүретін қозғалыс.</p>
          <p>Яғни:</p>
          <p className="study-lesson-equation">v = const</p>
          <p>Мысалы, егер дене әр секунд сайын 2 м жүрсе:</p>
          <div className="study-lesson-table" tabIndex={0} role="region" aria-label={tableLabel}>
            <table><tbody><tr><th scope="row">t, с</th><td>0</td><td>1</td><td>2</td><td>3</td></tr><tr><th scope="row">s, м</th><td>0</td><td>2</td><td>4</td><td>6</td></tr></tbody></table>
          </div>
          <p>Жылдамдық тұрақты:</p>
          <p className="study-lesson-equation">v = 2 м/с</p>
          <figure>
            <img src="/study/lessons/motion7-kk-uniform.png" alt="0, 1, 2 және 3 секундтағы дене орындары бірдей аралықпен орналасқан" loading="lazy" />
            <figcaption>Бірдей уақытта бірдей жол.</figcaption>
          </figure>
        </section>
        <section>
          <h3>Бірқалыпсыз қозғалыс</h3>
          <p><strong>Бірқалыпсыз қозғалыс</strong> — дене бірдей уақыт аралықтарында әртүрлі жол жүретін қозғалыс. Яғни жылдамдық өзгереді.</p>
          <p>Мысалы:</p>
          <div className="study-lesson-table" tabIndex={0} role="region" aria-label={tableLabel}>
            <table><tbody><tr><th scope="row">t, с</th><td>0</td><td>1</td><td>2</td><td>3</td></tr><tr><th scope="row">s, м</th><td>0</td><td>1</td><td>3</td><td>6</td></tr></tbody></table>
          </div>
          <p>Бірінші секундта дене 1 м, екінші секундта 2 м, үшінші секундта 3 м жүрді.</p>
          <p>Жүрілген жолдар әртүрлі, сондықтан қозғалыс бірқалыпсыз.</p>
        </section>
        <section>
          <h3>Бірқалыпты және бірқалыпсыз қозғалыс</h3>
          <div className="study-lesson-table" tabIndex={0} role="region" aria-label={tableLabel}>
            <table>
              <thead><tr><th scope="col">Бірқалыпты</th><th scope="col">Бірқалыпсыз</th></tr></thead>
              <tbody>
                <tr><td>Жылдамдық тұрақты</td><td>Жылдамдық өзгереді</td></tr>
                <tr><td>Бірдей уақыт аралықтарында бірдей жол жүреді</td><td>Бірдей уақыт аралықтарында әртүрлі жол жүреді</td></tr>
                <tr><td>s = vt формуласын қолдануға болады</td><td>Барлық қозғалыс үшін орташа жылдамдықты табу ыңғайлы</td></tr>
              </tbody>
            </table>
          </div>
        </section>
        <section>
          <h3>Графиктердегі өлшем бірліктері</h3>
          <p>Әр координаталық осьте мынаны көрсету керек:</p>
          <p className="study-lesson-equation">физикалық шама + өлшем бірлігі</p>
          <p>Мысалы, қате: t. Дұрыс: t, с. Қате: s. Дұрыс: s, м.</p>
          <p>Жылдамдық графигі үшін:</p>
          <p className="study-lesson-equation">v, м/с</p>
          <figure>
            <img src="/study/lessons/motion7-kk-axes.png" alt="График осьтерінде s, м және t, с деп физикалық шамалар мен өлшем бірліктері көрсетілген" loading="lazy" />
            <figcaption>Осьтерде физикалық шама мен өлшем бірлігі бірге көрсетіледі.</figcaption>
          </figure>
          <p>Егер графикте өлшем бірліктері көрсетілмесе, сандық мәндердің физикалық мағынасын дәл анықтау мүмкін емес.</p>
        </section>
        <section>
          <h3>Кестелердегі өлшем бірліктері</h3>
          <p>Дәл осы ереже кестелерге де қолданылады. Мысалы:</p>
          <div className="study-lesson-table" tabIndex={0} role="region" aria-label={tableLabel}>
            <table><tbody><tr><th scope="row">t, с</th><td>0</td><td>2</td><td>5</td></tr><tr><th scope="row">s, м</th><td>0</td><td>4</td><td>10</td></tr></tbody></table>
          </div>
          <p>Мұнда бірден көрінеді: t секундпен өлшенеді, ал s метрмен өлшенеді.</p>
        </section>
        <section>
          <h3>Орын ауыстырудың уақытқа тәуелділік графигі</h3>
          <p>Орын ауыстырудың уақытқа тәуелділік графигі бойынша қозғалыс жылдамдығын анықтауға болады. Бірқалыпты қозғалыста график түзу сызық болады.</p>
          <figure>
            <img src="/study/lessons/motion7-kk-slope.png" alt="S-тің t-ға тәуелділік графигіндегі көлбеу түзу және Δt, ΔS өзгерістері көрсетілген тікбұрышты үшбұрыш" loading="lazy" />
            <figcaption>Жылдамдық орын ауыстыру өзгерісінің уақыт өзгерісіне қатынасына тең.</figcaption>
          </figure>
          <p>Жылдамдық белгілі бір уақыт ішінде орын ауыстырудың қаншалықты өзгергенін көрсетеді:</p>
          <p className="study-lesson-equation">v = ΔS / Δt</p>
          <p>Егер график (0; 0) нүктесінен басталса, мына формуланы қолдануға болады:</p>
          <p className="study-lesson-equation">v = S / t</p>
        </section>
        <section>
          <h3>Графиктің көлбеулігі және жылдамдық</h3>
          <p>Екі денені қарастырайық.</p>
          <figure>
            <img src="/study/lessons/motion7-kk-compare.png" alt="Бірінші дененің S(t) графигі екінші дененің графигіне қарағанда тіктеу" loading="lazy" />
            <figcaption>Бірінші дененің жылдамдығы екінші дененікінен үлкен.</figcaption>
          </figure>
          <p>Бірінші сызықтың горизонтальмен жасайтын бұрышы үлкенірек. Бұл бірдей уақыт ішінде бірінші дененің көбірек жол жүретінін білдіреді. Демек:</p>
          <p className="study-lesson-equation">v<sub>1</sub> &gt; v<sub>2</sub></p>
          <p>Орын ауыстырудың уақытқа тәуелділік графигіндегі сызық неғұрлым тік болса, дененің жылдамдығы соғұрлым үлкен болады.</p>
        </section>
        <section>
          <h3>График бойынша жылдамдықты анықтау мысалы</h3>
          <p>График мына нүкте арқылы өтсін:</p>
          <p className="study-lesson-equation">t = 5 с, S = 10 м</p>
          <p>Онда:</p>
          <p className="study-lesson-equation">v = S / t</p>
          <p className="study-lesson-equation">v = 10 / 5</p>
          <p className="study-lesson-equation">v = 2 м/с</p>
          <p>Басқа нүкте арқылы тексеруге болады:</p>
          <p className="study-lesson-equation">t = 2 с, S = 4 м</p>
          <p className="study-lesson-equation">v = 4 / 2 = 2 м/с</p>
          <p>Жылдамдық өзгермейді. Демек, қозғалыс бірқалыпты.</p>
        </section>
        <section>
          <h3>Графиктегі тыныштық күйі</h3>
          <p>Егер дененің орны өзгермесе, дене тыныштық күйінде болады. Графикте бұл <strong>горизонталь бөлікке</strong> сәйкес келеді.</p>
          <figure>
            <img src="/study/lessons/motion7-kk-rest.png" alt="S(t) графигі 0-ден 4 секундқа дейін өседі, 4 секундтан кейін горизонталь болады" loading="lazy" />
            <figcaption>Көлбеу бөлік — қозғалыс, горизонталь бөлік — тыныштық.</figcaption>
          </figure>
          <p>0-ден 4 с-қа дейін S артады, сондықтан дене қозғалады. 4 с-тан кейін:</p>
          <p className="study-lesson-equation">S = const</p>
          <p>Сондықтан дене тыныштық күйінде болады.</p>
          <p className="study-lesson-equation">v = 0</p>
        </section>
        <section>
          <h3>Қозғалыс графигін қалай оқу керек</h3>
          <div className="study-lesson-table" tabIndex={0} role="region" aria-label={tableLabel}>
            <table>
              <thead><tr><th scope="col">График түрі</th><th scope="col">Не болып жатыр</th></tr></thead>
              <tbody>
                <tr><th scope="row">Көлбеу түзу</th><td>Дене тұрақты жылдамдықпен қозғалады</td></tr>
                <tr><th scope="row">Горизонталь сызық</th><td>Дене тыныштық күйінде</td></tr>
                <tr><th scope="row">Тіктеу сызық</th><td>Жылдамдық үлкен</td></tr>
                <tr><th scope="row">Сызықтың көлбеулігі өзгереді</th><td>Жылдамдық өзгереді</td></tr>
              </tbody>
            </table>
          </div>
        </section>
        <section>
          <h3>Жылдамдықтың уақытқа тәуелділік графигі</h3>
          <p>Енді графиктің басқа түрін қарастырайық: v(t).</p>
          <p>Горизонталь ось бойынша:</p>
          <p className="study-lesson-equation">t, с</p>
          <p>Вертикаль ось бойынша:</p>
          <p className="study-lesson-equation">v, м/с</p>
          <p>Егер жылдамдық тұрақты болса:</p>
          <p className="study-lesson-equation">v = const</p>
          <p>График горизонталь сызық түрінде болады.</p>
          <figure>
            <img src="/study/lessons/motion7-kk-speed.png" alt="Тұрақты жылдамдықтың v(t) графигі — уақыт осіне параллель горизонталь сызық" loading="lazy" />
            <figcaption>Тұрақты жылдамдықтың уақытқа тәуелділік графигі.</figcaption>
          </figure>
        </section>
        <section>
          <h3>Жылдамдық графигі бойынша жол</h3>
          <p>Тұрақты жылдамдық үшін:</p>
          <p className="study-lesson-equation">s = vt</p>
          <p>v(t) графигінде vt шамасы тіктөртбұрыштың ауданына тең.</p>
          <figure>
            <img src="/study/lessons/motion7-kk-area.png" alt="v(t) графигінің астындағы биіктігі v және ені t болатын боялған тіктөртбұрыш; оның ауданы s = vt" loading="lazy" />
            <figcaption>График астындағы тіктөртбұрыштың ауданы жүрілген жолды көрсетеді.</figcaption>
          </figure>
          <p>Сондықтан:</p>
          <p className="study-lesson-equation">жол = v(t) графигінің астындағы аудан</p>
          <p>Тұрақты жылдамдық кезінде бұл аудан:</p>
          <p className="study-lesson-equation">s = v · t</p>
        </section>
        <section>
          <h3>Мысал: график астындағы аудан</h3>
          <p>Дене мына жылдамдықпен қозғалады:</p>
          <p className="study-lesson-equation">v = 2 м/с</p>
          <p>Мына уақыт бойы:</p>
          <p className="study-lesson-equation">t = 3 с</p>
          <p>Графикте тіктөртбұрыш пайда болады. Оның ауданы:</p>
          <p className="study-lesson-equation">s = vt</p>
          <p className="study-lesson-equation">s = 2 · 3</p>
          <p className="study-lesson-equation">s = 6 м</p>
          <p>Өлшем бірліктерін тексерейік:</p>
          <p className="study-lesson-equation">(м/с) · с = м</p>
          <p>Жолдың өлшем бірлігін алдық.</p>
        </section>
        <section>
          <h3>Нені шатастырмау керек</h3>
          <p><strong>Орын ауыстырудың уақытқа тәуелділік графигі S(t):</strong> сызықтың көлбеулігі бойынша жылдамдықты анықтаймыз.</p>
          <p className="study-lesson-equation">v = ΔS / Δt</p>
          <p><strong>Жылдамдықтың уақытқа тәуелділік графигі v(t):</strong> график астындағы аудан бойынша тұрақты оң жылдамдық кезіндегі жолды анықтаймыз.</p>
          <p className="study-lesson-equation">s = vt</p>
        </section>
      </>
    )
  }

  return (
    <>
      <section>
        <h3>Механическое движение</h3>
        <p><strong>Механическое движение</strong> — это изменение положения тела или частей тела с течением времени относительно другого тела.</p>
        <p>Проще говоря, если положение тела со временем меняется, то тело движется. Но здесь есть важная деталь: движение всегда рассматривается относительно чего-либо.</p>
        <p>Например, автомобиль движется относительно дороги, человек идёт относительно земли, а поезд движется относительно станции.</p>
      </section>
      <section>
        <h3>Тело отсчёта</h3>
        <p><strong>Тело отсчёта</strong> — это тело, относительно которого рассматривают движение другого тела.</p>
        <p>Рассмотрим пассажира, который сидит в движущемся поезде.</p>
        <figure>
          <img src="/study/lessons/motion7-ru-reference.png" alt="Пассажир внутри поезда, движущегося вправо относительно земли" loading="lazy" />
          <figcaption>Пассажир покоится относительно вагона и движется вместе с поездом относительно земли.</figcaption>
        </figure>
        <p>Относительно вагона пассажир находится в покое. Но относительно земли он движется вместе с поездом.</p>
        <p>Одно и то же тело может одновременно находиться в покое относительно одного тела и двигаться относительно другого. Поэтому нельзя просто сказать: «тело движется». Нужно уточнить: «относительно чего оно движется?»</p>
      </section>
      <section>
        <h3>Материальная точка</h3>
        <p><strong>Материальная точка</strong> — это тело, размерами которого в данной задаче можно пренебречь.</p>
        <p>Например, самолёт летит из одного города в другой. Расстояние между городами намного больше размеров самолёта, поэтому самолёт можно считать материальной точкой.</p>
        <p>Но если автомобиль заезжает в гараж, его размеры уже имеют значение. В такой задаче считать автомобиль материальной точкой нельзя.</p>
      </section>
      <section>
        <h3>Траектория</h3>
        <p><strong>Траектория</strong> — линия, по которой движется тело.</p>
        <p>Траектория может быть:</p>
        <div className="study-lesson-table" tabIndex={0} role="region" aria-label={tableLabel}>
          <table>
            <thead><tr><th scope="col">Вид</th><th scope="col">Объяснение</th></tr></thead>
            <tbody>
              <tr><th scope="row">Прямолинейная</th><td>Тело движется по прямой линии</td></tr>
              <tr><th scope="row">Криволинейная</th><td>Тело движется по кривой линии</td></tr>
            </tbody>
          </table>
        </div>
        <figure>
          <img src="/study/lessons/motion7-ru-trajectories.png" alt="Слева прямая направленная линия, справа кривая направленная линия" loading="lazy" />
          <figcaption>Прямолинейное и криволинейное движение.</figcaption>
        </figure>
      </section>
      <section>
        <h3>Путь</h3>
        <p><strong>Путь</strong> — это длина траектории, по которой двигалось тело.</p>
        <p>Обозначение:</p>
        <p className="study-lesson-equation">s</p>
        <p>Единица измерения в СИ:</p>
        <p className="study-lesson-equation">[s] = м</p>
        <p>Путь показывает, <strong>сколько всего прошло тело.</strong></p>
        <ul>
          <li>Путь не имеет направления.</li>
          <li>Путь является скалярной величиной.</li>
          <li>Путь не может быть отрицательным.</li>
        </ul>
        <p>Например, ученик прошёл от дома до школы 200 м, а затем вернулся домой ещё 200 м. Общий путь:</p>
        <p className="study-lesson-equation">s = 200 + 200</p>
        <p className="study-lesson-equation">s = 400 м</p>
      </section>
      <section>
        <h3>Перемещение</h3>
        <p><strong>Перемещение</strong> — это направленный отрезок от начального положения тела до его конечного положения.</p>
        <p>В отличие от пути, перемещение имеет направление.</p>
        <figure>
          <img src="/study/lessons/motion7-ru-displacement.png" alt="Кривая траектория между начальной и конечной точками и красная прямая стрелка перемещения между ними" loading="lazy" />
          <figcaption>Путь проходит по всей траектории. Перемещение соединяет начальную и конечную точки прямым направленным отрезком.</figcaption>
        </figure>
      </section>
      <section>
        <h3>Путь и перемещение</h3>
        <div className="study-lesson-table" tabIndex={0} role="region" aria-label={tableLabel}>
          <table>
            <thead><tr><th scope="col">Путь</th><th scope="col">Перемещение</th></tr></thead>
            <tbody>
              <tr><td>Длина всей траектории</td><td>Соединяет начальное и конечное положения</td></tr>
              <tr><td>Не имеет направления</td><td>Имеет направление</td></tr>
              <tr><td>Скалярная величина</td><td>Векторная величина</td></tr>
              <tr><td>Не может быть отрицательным</td><td>Может быть равно нулю</td></tr>
            </tbody>
          </table>
        </div>
        <p>Например, если ученик вышел из дома, дошёл до школы и затем вернулся домой, то его путь:</p>
        <p className="study-lesson-equation">s &gt; 0</p>
        <p>Но перемещение:</p>
        <p className="study-lesson-equation">S = 0</p>
        <p>Потому что конечная точка совпала с начальной.</p>
      </section>
      <section>
        <h3>Пример: падающий мяч</h3>
        <p>Мяч падает с высоты 5 м, а затем отскакивает вверх на 2.5 м.</p>
        <p>Путь:</p>
        <p className="study-lesson-equation">s = 5 + 2.5</p>
        <p className="study-lesson-equation">s = 7.5 м</p>
        <p>Перемещение:</p>
        <p className="study-lesson-equation">S = 5 − 2.5</p>
        <p className="study-lesson-equation">S = 2.5 м вниз</p>
        <p>Здесь хорошо видно:</p>
        <p className="study-lesson-equation">путь ≠ перемещение</p>
      </section>
      <section>
        <h3>Скорость</h3>
        <p><strong>Скорость</strong> — физическая величина, которая показывает быстроту движения тела.</p>
        <p>Для равномерного движения:</p>
        <p className="study-lesson-equation">v = s / t</p>
        <p>Где:</p>
        <ul><li>v — скорость;</li><li>s — пройденный путь;</li><li>t — время движения.</li></ul>
        <p>Единица скорости в СИ:</p>
        <p className="study-lesson-equation">[v] = м/с</p>
        <p>То есть скорость показывает, какой путь тело проходит за единицу времени.</p>
        <p>Например:</p>
        <p className="study-lesson-equation">v = 5 м/с</p>
        <p>Это означает, что при равномерном движении тело каждую секунду проходит 5 м.</p>
      </section>
      <section>
        <h3>Формулы пути, скорости и времени</h3>
        <p>Основная формула:</p>
        <p className="study-lesson-equation">v = s / t</p>
        <p>Из неё получаем путь:</p>
        <p className="study-lesson-equation">s = vt</p>
        <p>И время:</p>
        <p className="study-lesson-equation">t = s / v</p>
        <p className="study-lesson-equation">v = s / t; s = vt; t = s / v</p>
      </section>
      <section>
        <h3>Средняя скорость</h3>
        <p>При неравномерном движении скорость тела может меняться. Поэтому удобно использовать среднюю скорость.</p>
        <p><strong>Средняя скорость</strong> — это отношение всего пройденного пути ко всему времени движения.</p>
        <p className="study-lesson-equation">v<sub>ср</sub> = s<sub>общ</sub> / t<sub>общ</sub></p>
        <p>Если движение состоит из нескольких частей:</p>
        <p className="study-lesson-equation">s<sub>общ</sub> = s<sub>1</sub> + s<sub>2</sub> + s<sub>3</sub> + …</p>
        <p>И:</p>
        <p className="study-lesson-equation">t<sub>общ</sub> = t<sub>1</sub> + t<sub>2</sub> + t<sub>3</sub> + …</p>
        <p>После этого:</p>
        <p className="study-lesson-equation">v<sub>ср</sub> = (s<sub>1</sub> + s<sub>2</sub> + s<sub>3</sub> + …) / (t<sub>1</sub> + t<sub>2</sub> + t<sub>3</sub> + …)</p>
        <p>В общем случае среднюю скорость нельзя находить, просто складывая несколько скоростей и деля на их количество. Если время движения на участках различается, такой способ может дать неверный результат. Если на каждом участке скорость постоянна, а время движения на всех участках одинаково, можно использовать среднее арифметическое скоростей. Общий способ — разделить <strong>весь путь</strong> на <strong>всё время.</strong></p>
      </section>
      <section>
        <h3>Пример на среднюю скорость</h3>
        <p>Автобус проехал 1.2 км за 5 мин. Переведём величины в СИ:</p>
        <p className="study-lesson-equation">1.2 км = 1200 м</p>
        <p className="study-lesson-equation">5 мин = 300 с</p>
        <p>Используем:</p>
        <p className="study-lesson-equation">v<sub>ср</sub> = s / t</p>
        <p>Получаем:</p>
        <p className="study-lesson-equation">v<sub>ср</sub> = 1200 / 300</p>
        <p className="study-lesson-equation">v<sub>ср</sub> = 4 м/с</p>
      </section>
      <section>
        <h3>Перевод км/ч в м/с</h3>
        <p>Поскольку:</p>
        <p className="study-lesson-equation">1 км = 1000 м</p>
        <p>И:</p>
        <p className="study-lesson-equation">1 ч = 3600 с</p>
        <p>То:</p>
        <p className="study-lesson-equation">1 км/ч = (1000 / 3600) м/с</p>
        <p>Например:</p>
        <p className="study-lesson-equation">36 км/ч = (36 · 1000) / 3600</p>
        <p className="study-lesson-equation">36 км/ч = 10 м/с</p>
        <div className="study-lesson-table" tabIndex={0} role="region" aria-label={tableLabel}>
          <table>
            <thead><tr><th scope="col">км/ч</th><th scope="col">м/с</th></tr></thead>
            <tbody><tr><td>36</td><td>10</td></tr><tr><td>72</td><td>20</td></tr><tr><td>108</td><td>30</td></tr></tbody>
          </table>
        </div>
      </section>
      <section>
        <h3>Равномерное движение</h3>
        <p><strong>Равномерное движение</strong> — движение, при котором тело за равные промежутки времени проходит равные расстояния.</p>
        <p>То есть:</p>
        <p className="study-lesson-equation">v = const</p>
        <p>Например, если тело каждую секунду проходит по 2 м:</p>
        <div className="study-lesson-table" tabIndex={0} role="region" aria-label={tableLabel}>
          <table><tbody><tr><th scope="row">t, с</th><td>0</td><td>1</td><td>2</td><td>3</td></tr><tr><th scope="row">s, м</th><td>0</td><td>2</td><td>4</td><td>6</td></tr></tbody></table>
        </div>
        <p>Скорость постоянна:</p>
        <p className="study-lesson-equation">v = 2 м/с</p>
        <figure>
          <img src="/study/lessons/motion7-ru-uniform.png" alt="Положения тела в 0, 1, 2 и 3 секунды разделены одинаковыми расстояниями" loading="lazy" />
          <figcaption>Равные расстояния за равное время.</figcaption>
        </figure>
      </section>
      <section>
        <h3>Неравномерное движение</h3>
        <p><strong>Неравномерное движение</strong> — движение, при котором тело за равные промежутки времени проходит разные расстояния. То есть скорость изменяется.</p>
        <p>Например:</p>
        <div className="study-lesson-table" tabIndex={0} role="region" aria-label={tableLabel}>
          <table><tbody><tr><th scope="row">t, с</th><td>0</td><td>1</td><td>2</td><td>3</td></tr><tr><th scope="row">s, м</th><td>0</td><td>1</td><td>3</td><td>6</td></tr></tbody></table>
        </div>
        <p>За первую секунду тело прошло 1 м, за вторую — 2 м, за третью — 3 м.</p>
        <p>Расстояния разные, поэтому движение неравномерное.</p>
      </section>
      <section>
        <h3>Равномерное и неравномерное движение</h3>
        <div className="study-lesson-table" tabIndex={0} role="region" aria-label={tableLabel}>
          <table>
            <thead><tr><th scope="col">Равномерное</th><th scope="col">Неравномерное</th></tr></thead>
            <tbody>
              <tr><td>Скорость постоянна</td><td>Скорость изменяется</td></tr>
              <tr><td>За равные промежутки времени проходит равные расстояния</td><td>За равные промежутки времени проходит разные расстояния</td></tr>
              <tr><td>Можно использовать s = vt</td><td>Для всего движения удобно находить среднюю скорость</td></tr>
            </tbody>
          </table>
        </div>
      </section>
      <section>
        <h3>Единицы измерения на графиках</h3>
        <p>На каждой координатной оси нужно указывать:</p>
        <p className="study-lesson-equation">физическую величину + единицу измерения</p>
        <p>Например, неправильно: t. Правильно: t, с. Неправильно: s. Правильно: s, м.</p>
        <p>Для графика скорости:</p>
        <p className="study-lesson-equation">v, м/с</p>
        <figure>
          <img src="/study/lessons/motion7-ru-axes.png" alt="На осях графика указаны физические величины с единицами измерения: s, м и t, с" loading="lazy" />
          <figcaption>Физическая величина и единица измерения указываются вместе.</figcaption>
        </figure>
        <p>Если на графике не указаны единицы измерения, нельзя точно определить физический смысл числовых значений.</p>
      </section>
      <section>
        <h3>Единицы измерения в таблицах</h3>
        <p>То же правило действует для таблиц. Например:</p>
        <div className="study-lesson-table" tabIndex={0} role="region" aria-label={tableLabel}>
          <table><tbody><tr><th scope="row">t, с</th><td>0</td><td>2</td><td>5</td></tr><tr><th scope="row">s, м</th><td>0</td><td>4</td><td>10</td></tr></tbody></table>
        </div>
        <p>Здесь сразу видно: t измеряется в секундах, а s измеряется в метрах.</p>
      </section>
      <section>
        <h3>График перемещения от времени</h3>
        <p>По графику зависимости перемещения от времени можно определить скорость движения. При равномерном движении график является прямой линией.</p>
        <figure>
          <img src="/study/lessons/motion7-ru-slope.png" alt="Наклонная прямая на графике S(t) и прямоугольный треугольник с изменениями Δt и ΔS" loading="lazy" />
          <figcaption>Скорость равна отношению изменения перемещения к изменению времени.</figcaption>
        </figure>
        <p>Скорость показывает, насколько изменилось перемещение за определённое время:</p>
        <p className="study-lesson-equation">v = ΔS / Δt</p>
        <p>Если график начинается из точки (0; 0), можно использовать:</p>
        <p className="study-lesson-equation">v = S / t</p>
      </section>
      <section>
        <h3>Наклон графика и скорость</h3>
        <p>Рассмотрим два тела.</p>
        <figure>
          <img src="/study/lessons/motion7-ru-compare.png" alt="График S(t) первого тела поднимается круче, чем график второго тела" loading="lazy" />
          <figcaption>Скорость первого тела больше скорости второго.</figcaption>
        </figure>
        <p>Первая линия имеет больший угол относительно горизонтали. Это означает, что за одинаковое время первое тело проходит большее расстояние. Следовательно:</p>
        <p className="study-lesson-equation">v<sub>1</sub> &gt; v<sub>2</sub></p>
        <p>Чем круче линия на графике перемещения от времени, тем больше скорость тела.</p>
      </section>
      <section>
        <h3>Пример определения скорости по графику</h3>
        <p>Пусть график проходит через точку:</p>
        <p className="study-lesson-equation">t = 5 с, S = 10 м</p>
        <p>Тогда:</p>
        <p className="study-lesson-equation">v = S / t</p>
        <p className="study-lesson-equation">v = 10 / 5</p>
        <p className="study-lesson-equation">v = 2 м/с</p>
        <p>Можно проверить по другой точке:</p>
        <p className="study-lesson-equation">t = 2 с, S = 4 м</p>
        <p className="study-lesson-equation">v = 4 / 2 = 2 м/с</p>
        <p>Скорость не меняется. Значит движение равномерное.</p>
      </section>
      <section>
        <h3>Покой на графике</h3>
        <p>Если положение тела не меняется, то тело находится в состоянии покоя. На графике это соответствует <strong>горизонтальному участку.</strong></p>
        <figure>
          <img src="/study/lessons/motion7-ru-rest.png" alt="График S(t) растёт от 0 до 4 секунд и становится горизонтальным после 4 секунд" loading="lazy" />
          <figcaption>Наклонный участок — движение, горизонтальный — покой.</figcaption>
        </figure>
        <p>От 0 до 4 с S увеличивается, поэтому тело движется. После 4 с:</p>
        <p className="study-lesson-equation">S = const</p>
        <p>Поэтому тело находится в покое.</p>
        <p className="study-lesson-equation">v = 0</p>
      </section>
      <section>
        <h3>Как читать график движения</h3>
        <div className="study-lesson-table" tabIndex={0} role="region" aria-label={tableLabel}>
          <table>
            <thead><tr><th scope="col">Вид графика</th><th scope="col">Что происходит</th></tr></thead>
            <tbody>
              <tr><th scope="row">Наклонная прямая</th><td>Тело движется с постоянной скоростью</td></tr>
              <tr><th scope="row">Горизонтальная линия</th><td>Тело находится в покое</td></tr>
              <tr><th scope="row">Более крутая линия</th><td>Скорость больше</td></tr>
              <tr><th scope="row">Меняется наклон линии</th><td>Скорость изменяется</td></tr>
            </tbody>
          </table>
        </div>
      </section>
      <section>
        <h3>График скорости от времени</h3>
        <p>Теперь рассмотрим другой вид графика: v(t).</p>
        <p>По горизонтальной оси:</p>
        <p className="study-lesson-equation">t, с</p>
        <p>По вертикальной:</p>
        <p className="study-lesson-equation">v, м/с</p>
        <p>Если скорость постоянна:</p>
        <p className="study-lesson-equation">v = const</p>
        <p>График представляет горизонтальную линию.</p>
        <figure>
          <img src="/study/lessons/motion7-ru-speed.png" alt="График v(t) при постоянной скорости — горизонтальная линия, параллельная оси времени" loading="lazy" />
          <figcaption>График постоянной скорости от времени.</figcaption>
        </figure>
      </section>
      <section>
        <h3>Путь по графику скорости</h3>
        <p>Для постоянной скорости:</p>
        <p className="study-lesson-equation">s = vt</p>
        <p>На графике v(t) величина vt представляет собой площадь прямоугольника.</p>
        <figure>
          <img src="/study/lessons/motion7-ru-area.png" alt="Закрашенный прямоугольник под графиком v(t) с высотой v, шириной t и площадью s = vt" loading="lazy" />
          <figcaption>Площадь прямоугольника под графиком равна пройденному пути.</figcaption>
        </figure>
        <p>Поэтому:</p>
        <p className="study-lesson-equation">путь = площадь под графиком v(t)</p>
        <p>Для постоянной скорости эта площадь равна:</p>
        <p className="study-lesson-equation">s = v · t</p>
      </section>
      <section>
        <h3>Пример: площадь под графиком</h3>
        <p>Тело движется со скоростью:</p>
        <p className="study-lesson-equation">v = 2 м/с</p>
        <p>В течение:</p>
        <p className="study-lesson-equation">t = 3 с</p>
        <p>На графике получаем прямоугольник. Его площадь:</p>
        <p className="study-lesson-equation">s = vt</p>
        <p className="study-lesson-equation">s = 2 · 3</p>
        <p className="study-lesson-equation">s = 6 м</p>
        <p>Проверим единицы:</p>
        <p className="study-lesson-equation">(м/с) · с = м</p>
        <p>Получили единицу пути.</p>
      </section>
      <section>
        <h3>Что важно не перепутать</h3>
        <p><strong>График перемещения от времени S(t):</strong> по наклону линии определяем скорость.</p>
        <p className="study-lesson-equation">v = ΔS / Δt</p>
        <p><strong>График скорости от времени v(t):</strong> по площади под графиком определяем путь при постоянной положительной скорости.</p>
        <p className="study-lesson-equation">s = vt</p>
      </section>
    </>
  )
}
