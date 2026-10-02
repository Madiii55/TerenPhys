import React, { useState } from 'react';
import { ArrowRight, ChevronRight, Play, CheckCircle2, ChevronDown, BookOpen, ArrowLeft, ExternalLink, HelpCircle } from 'lucide-react';

type StudyLevel = 'classes' | 'sections' | 'topics' | 'lesson';

export const StudyPage: React.FC = () => {
  const [level, setLevel] = useState<StudyLevel>('classes');
  const [selectedClass, setSelectedClass] = useState<number>(9);
  const [selectedSection, setSelectedSection] = useState<string>('Механика');
  const [selectedTopic, setSelectedTopic] = useState<string>('Кинематика');
  const [showTheoryModal, setShowTheoryModal] = useState<boolean>(false);
  const [showMoreTasks, setShowMoreTasks] = useState<boolean>(false);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [feedback, setFeedback] = useState<Record<number, boolean | null>>({});

  const classesList = [7, 8, 9];

  const sectionsByClass: Record<number, string[]> = {
    7: ['Введение в физику', 'Строение вещества', 'Движение и силы', 'Давление жидкостей и газов', 'Работа и мощность'],
    8: ['Тепловые явления', 'Изменение агрегатных состояний', 'Электрические явления', 'Электромагнитные явления', 'Световые явления'],
    9: ['Механика', 'Молекулярная физика', 'Электричество', 'Магнетизм', 'Оптика', 'Атомная и ядерная физика'],
  };

  const topicsBySection: Record<string, string[]> = {
    'Механика': [
      'Кинематика',
      'Динамика',
      'Законы Ньютона',
      'Силы',
      'Импульс и закон сохранения импульса',
      'Работа, мощность, энергия',
      'Закон сохранения энергии',
      'Механические колебания и волны',
    ],
    'Молекулярная физика': ['Строение вещества', 'Температура и давление', 'Идеальный газ', 'Уравнение Менделеева-Клапейрона'],
    'Электричество': ['Электрический заряд', 'Закон Кулона', 'Электрическое поле', 'Закон Ома', 'Работа и мощность тока'],
    'Магнетизм': ['Магнитное поле', 'Действие магнитного поля на ток', 'Сила Лоренца', 'Электромагнитная индукция'],
    'Оптика': ['Законы отражения и преломления света', 'Линзы', 'Построение изображений', 'Оптические приборы'],
    'Атомная и ядерная физика': ['Строение атома', 'Радиоактивность', 'Ядерные реакции', 'Энергия связи ядер'],
  };

  const tasks = [
    {
      id: 1,
      text: 'Тело движется по прямой с ускорением 2 м/с². Какова его скорость через 5 секунд, если начальная скорость равна 10 м/с?',
      answer: '20',
      hint: 'Используйте формулу скорости при равноускоренном движении: v = v₀ + a·t',
    },
    {
      id: 2,
      text: 'Автомобиль начинает движение с места и разгоняется равномерно с ускорением 1,5 м/с². Какой путь он пройдет за 8 секунд?',
      answer: '48',
      hint: 'Для движения без начальной скорости: S = (a · t²) / 2. (1.5 * 64) / 2 = 48 м.',
    },
    {
      id: 3,
      text: 'Точка движется по окружности радиусом 10 м. Период обращения 4 с. Найдите линейную скорость точки.',
      answer: '15.7',
      hint: 'v = (2 · π · R) / T = (2 · 3.14 · 10) / 4 ≈ 15.7 м/с.',
    },
    {
      id: 4,
      text: 'Снаряд вылетает из пушки со скоростью 500 м/с под углом 30° к горизонту. Найдите вертикальную составляющую начальной скорости.',
      answer: '250',
      hint: 'v_y = v₀ · sin(30°) = 500 · 0.5 = 250 м/с.',
    },
    {
      id: 5,
      text: 'С какой высоты падало свободно тело, если время падения составило 3 секунды? (g = 10 м/с²)',
      answer: '45',
      hint: 'h = (g · t²) / 2 = (10 · 9) / 2 = 45 м.',
    },
  ];

  const handleCheckAnswer = (id: number, correctAnswer: string) => {
    const val = (answers[id] || '').trim();
    if (val === correctAnswer || parseFloat(val) === parseFloat(correctAnswer)) {
      setFeedback((prev) => ({ ...prev, [id]: true }));
    } else {
      setFeedback((prev) => ({ ...prev, [id]: false }));
    }
  };

  return (
    <div className="relative min-h-[calc(100svh-5rem)] overflow-hidden py-10 px-4 sm:px-6">
      <div className={`max-w-7xl mx-auto relative z-10 ${level === 'lesson' ? 'study-lesson' : 'study-navigation'}`}>
        {/* Navigation Breadcrumb when inside drilldown */}
        {level !== 'classes' && (
          <div className="mb-6 flex items-center gap-3 text-sm text-gray-500">
            <button
              onClick={() => setLevel('classes')}
              className="hover:text-[#0284c7] transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              Все классы
            </button>
            <span>/</span>
            <button
              onClick={() => setLevel('sections')}
              className={`hover:text-[#0284c7] transition-colors cursor-pointer ${
                level === 'sections' ? 'text-gray-900 font-medium' : ''
              }`}
            >
              {selectedClass} класс
            </button>
            {level !== 'sections' && (
              <>
                <span>/</span>
                <button
                  onClick={() => setLevel('topics')}
                  className={`hover:text-[#0284c7] transition-colors cursor-pointer ${
                    level === 'topics' ? 'text-gray-900 font-medium' : ''
                  }`}
                >
                  {selectedSection}
                </button>
              </>
            )}
            {level === 'lesson' && (
              <>
                <span>/</span>
                <span className="text-[#0284c7] font-medium">{selectedTopic}</span>
              </>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 1: "КЛАССЫ" - Exact representation of Image 4 top-left               */}
        {/* ========================================================================= */}
        {level === 'classes' && (
          <div className="min-h-[60vh] flex flex-col items-center justify-center">
            {/* Title from screenshot */}
            <h2 className="text-3xl md:text-4xl font-light tracking-widest text-gray-900 mb-16 text-center uppercase">
              КЛАССЫ
            </h2>

            {/* Horizontal Classes Selection matching Screenshot */}
            <div className="flex flex-wrap items-center justify-center gap-12 sm:gap-20 md:gap-28">
              {classesList.map((cls) => (
                <div
                  key={cls}
                  onClick={() => {
                    setSelectedClass(cls);
                    setLevel('sections');
                  }}
                  className="study-class group cursor-pointer flex items-baseline gap-3 transition-transform hover:-translate-y-1.5 select-none"
                >
                  <span className="text-6xl sm:text-7xl md:text-8xl font-extralight text-gray-900 group-hover:text-[#0284c7] transition-colors">
                    {cls}
                  </span>
                  <span className="text-2xl sm:text-3xl md:text-4xl font-light text-gray-800 group-hover:text-[#0284c7] transition-colors">
                    класс
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 2: "{CLASS} КЛАСС / РАЗДЕЛЫ" - Image 4 top-right                     */}
        {/* ========================================================================= */}
        {level === 'sections' && (
          <div className="max-w-5xl mx-auto py-6">
            <h2 className="text-xl md:text-2xl font-light tracking-wider text-gray-800 text-center uppercase mb-16 select-none">
              <button
                onClick={() => setLevel('classes')}
                className="hover:text-[#0284c7] transition-colors cursor-pointer"
                title="Вернуться к выбору класса"
              >
                {selectedClass} КЛАСС
              </button>{' '}
              / РАЗДЕЛЫ
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-12 items-start">
              {/* Left Side: Big Class Label - Clickable to return to classes */}
              <button
                type="button"
                onClick={() => setLevel('classes')}
                className="md:col-span-3 flex md:flex-col items-baseline md:items-start gap-3 group text-left cursor-pointer transition-transform hover:-translate-x-1 select-none"
                title="Вернуться к выбору класса"
              >
                <span className="text-7xl md:text-8xl font-extralight text-gray-900 group-hover:text-[#0284c7] transition-colors">
                  {selectedClass}
                </span>
                <span className="text-3xl md:text-4xl font-light text-gray-800 group-hover:text-[#0284c7] transition-colors">
                  класс
                </span>
              </button>

              {/* Right Side: Grid of Sections */}
              <div className="md:col-span-9 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-10">
                {(sectionsByClass[selectedClass] || sectionsByClass[9]).map((section) => {
                  const isCurrent = section === selectedSection;
                  return (
                    <button
                      key={section}
                      onClick={() => {
                        setSelectedSection(section);
                        setLevel('topics');
                      }}
                      className={`text-left text-lg md:text-xl font-light py-2 px-1 transition-colors cursor-pointer group flex items-center justify-between ${
                        isCurrent
                          ? 'text-[#0284c7] font-normal'
                          : 'text-gray-800 hover:text-[#0284c7]'
                      }`}
                    >
                      <span>{section}</span>
                      <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-[#0284c7]" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 3: "{CLASS} КЛАСС / {SECTION} / ТЕМЫ" - Image 4 bottom-left          */}
        {/* ========================================================================= */}
        {level === 'topics' && (
          <div className="max-w-5xl mx-auto py-6">
            <h2 className="text-xl md:text-2xl font-light tracking-wider text-gray-800 text-center uppercase mb-16 select-none">
              <button
                onClick={() => setLevel('classes')}
                className="hover:text-[#0284c7] transition-colors cursor-pointer"
                title="Вернуться к выбору класса"
              >
                {selectedClass} КЛАСС
              </button>{' '}
              /{' '}
              <button
                onClick={() => setLevel('sections')}
                className="hover:text-[#0284c7] transition-colors cursor-pointer"
                title="Вернуться к разделам"
              >
                {selectedSection.toUpperCase()}
              </button>{' '}
              / ТЕМЫ
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
              {/* Left Side: Class & Section breadcrumbs - both clickable to go back */}
              <div className="md:col-span-4 flex items-center gap-6 md:gap-8 border-b md:border-b-0 md:border-r border-gray-200 pb-6 md:pb-0 md:pr-6 select-none">
                <button
                  type="button"
                  onClick={() => setLevel('classes')}
                  className="group text-left cursor-pointer transition-transform hover:-translate-x-1"
                  title="Вернуться к выбору класса"
                >
                  <div className="text-6xl md:text-7xl font-extralight text-gray-900 leading-none group-hover:text-[#0284c7] transition-colors">
                    {selectedClass}
                  </div>
                  <div className="text-2xl md:text-3xl font-light text-gray-800 group-hover:text-[#0284c7] transition-colors">
                    класс
                  </div>
                </button>
                <div className="h-14 w-px bg-gray-300 hidden md:block" />
                <button
                  type="button"
                  onClick={() => setLevel('sections')}
                  className="text-xl md:text-2xl font-light text-gray-900 hover:text-[#0284c7] transition-colors cursor-pointer text-left"
                  title="Вернуться к разделам"
                >
                  {selectedSection}
                </button>
              </div>

              {/* Right Side: Topics list */}
              <div className="md:col-span-8 space-y-4 pl-0 md:pl-4">
                {(topicsBySection[selectedSection] || topicsBySection['Механика']).map((topic) => {
                  const isCurrent = topic === selectedTopic;
                  return (
                    <button
                      key={topic}
                      onClick={() => {
                        setSelectedTopic(topic);
                        setLevel('lesson');
                      }}
                      className={`w-full text-left py-2.5 px-3 rounded-lg transition-all cursor-pointer flex items-center justify-between group ${
                        isCurrent
                          ? 'text-[#0284c7] font-medium bg-blue-50/50'
                          : 'text-gray-800 hover:text-[#0284c7] hover:bg-gray-50/80'
                      }`}
                    >
                      <span className="text-lg font-light">{topic}</span>
                      <ArrowRight
                        className={`w-4 h-4 transition-transform group-hover:translate-x-1 ${
                          isCurrent ? 'text-[#0284c7] opacity-100' : 'text-gray-400 opacity-60'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 4: LESSON VIEW - Image 4 bottom-right                                */}
        {/* ========================================================================= */}
        {level === 'lesson' && (
          <div className="max-w-5xl mx-auto py-2">
            <div className="text-xs uppercase tracking-widest text-gray-500 mb-2 flex items-center gap-2 select-none">
              <button
                onClick={() => setLevel('classes')}
                className="hover:text-[#0284c7] cursor-pointer transition-colors"
                title="Вернуться к выбору класса"
              >
                {selectedClass} КЛАСС
              </button>
              <span>/</span>
              <button
                onClick={() => setLevel('sections')}
                className="hover:text-[#0284c7] cursor-pointer transition-colors"
                title="Вернуться к разделам"
              >
                {selectedSection.toUpperCase()}
              </button>
              <span>/</span>
              <button
                onClick={() => setLevel('topics')}
                className="hover:text-[#0284c7] cursor-pointer transition-colors"
                title="Вернуться к темам"
              >
                {selectedTopic.toUpperCase()}
              </button>
            </div>
            <h1 className="text-3xl md:text-4xl font-normal text-gray-950 mb-6">
              {selectedTopic}
            </h1>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Column: Video Mockup Player & Tasks */}
              <div className="lg:col-span-8 space-y-8">
                {/* Video Player Mockup with Cosmic Theme */}
                <div className="relative aspect-video rounded-xl bg-gray-950 overflow-hidden shadow-lg border border-gray-900 group">
                  <div className="absolute inset-0 bg-gradient-to-tr from-gray-950 via-slate-900 to-indigo-950/40 flex items-center justify-center">
                    {/* Simulated space planetary orbit view */}
                    <div className="relative w-44 h-44 rounded-full border border-white/20 flex items-center justify-center animate-spin-slow">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-400 to-cyan-200 opacity-80 blur-xs" />
                      <div className="absolute -top-2 left-1/2 w-4 h-4 rounded-full bg-white shadow-md shadow-white/50" />
                    </div>
                  </div>

                  {/* Play Button Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-black/60 backdrop-blur-xs border border-white/20 flex items-center justify-center cursor-pointer transition-transform group-hover:scale-110">
                      <Play className="w-7 h-7 text-white fill-white ml-1" />
                    </div>
                  </div>

                  {/* Video Controls Bar */}
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-4 flex items-center justify-between text-white text-xs">
                    <div className="flex items-center gap-3">
                      <Play className="w-4 h-4 fill-white" />
                      <span>0:00 / 12:43</span>
                    </div>
                    <div className="flex items-center gap-3 text-gray-400">
                      <span>1080p HD</span>
                    </div>
                  </div>
                </div>

                {/* Tasks Section (Задания) */}
                <div className="space-y-4">
                  <h3 className="text-xl font-normal text-gray-900">Задания</h3>

                  <div className="space-y-3">
                    {(showMoreTasks ? tasks : tasks.slice(0, 3)).map((task) => (
                      <div
                        key={task.id}
                        className="p-4 rounded-xl border border-gray-200/90 bg-white/90 shadow-2xs hover:border-[#0284c7]/50 transition-all"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <span className="text-sm font-semibold text-[#0284c7] mt-0.5">
                              {task.id}.
                            </span>
                            <div>
                              <p className="text-sm sm:text-base text-gray-800 leading-relaxed">
                                {task.text}
                              </p>
                              <div className="mt-3 flex flex-wrap items-center gap-3">
                                <input
                                  type="text"
                                  placeholder="Ваш ответ..."
                                  value={answers[task.id] || ''}
                                  onChange={(e) =>
                                    setAnswers({ ...answers, [task.id]: e.target.value })
                                  }
                                  className="text-xs sm:text-sm px-3 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:border-[#0284c7] w-36"
                                />
                                <button
                                  onClick={() => handleCheckAnswer(task.id, task.answer)}
                                  className="text-xs sm:text-sm px-3.5 py-1.5 rounded-lg bg-gray-900 text-white hover:bg-gray-800 cursor-pointer transition-colors"
                                >
                                  Проверить
                                </button>
                                {feedback[task.id] === true && (
                                  <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                                    <CheckCircle2 className="w-4 h-4" /> Верно!
                                  </span>
                                )}
                                {feedback[task.id] === false && (
                                  <span className="text-xs text-rose-500 font-medium">
                                    Неверно. Подсказка: {task.hint}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => setShowMoreTasks(!showMoreTasks)}
                    className="w-full py-2.5 rounded-xl border border-blue-200 text-[#0284c7] hover:bg-blue-50/50 text-sm font-medium transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span>{showMoreTasks ? 'Скрыть дополнительные задания' : 'Показать ещё'}</span>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${showMoreTasks ? 'rotate-180' : ''}`}
                    />
                  </button>
                </div>
              </div>

              {/* Right Column: Description & Detailed Theory CTA */}
              <div className="lg:col-span-4 space-y-6">
                <div className="p-6 rounded-2xl bg-white border border-gray-100 shadow-sm space-y-4">
                  <p className="text-gray-600 text-sm sm:text-base leading-relaxed font-light">
                    Кинематика — раздел механики, который описывает движение тел без учета причин, вызывающих это движение.
                  </p>

                  <button
                    onClick={() => setShowTheoryModal(true)}
                    className="w-full py-3 px-4 rounded-xl bg-[#0284c7] hover:bg-blue-600 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer group"
                  >
                    <span>Подробное объяснение темы</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </button>
                </div>

                {/* Key Formulas Snippet */}
                <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Ключевые формулы
                  </h4>
                  <div className="space-y-2 text-sm text-gray-800 font-mono">
                    <div className="p-2 rounded bg-white border border-gray-200/80">
                      v = v₀ + a · t
                    </div>
                    <div className="p-2 rounded bg-white border border-gray-200/80">
                      S = v₀ · t + (a · t²) / 2
                    </div>
                    <div className="p-2 rounded bg-white border border-gray-200/80">
                      v² - v₀² = 2 · a · S
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Theory Modal Dialog */}
      {showTheoryModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-8 shadow-2xl relative max-h-[85vh] overflow-y-auto">
            <h3 className="text-2xl font-light text-gray-900 mb-4">
              Кинематика: Конспект и формулы
            </h3>
            <div className="space-y-4 text-gray-700 text-sm leading-relaxed">
              <p>
                <strong>Основные понятия:</strong> Материальная точка — тело, размерами которого можно пренебречь в условиях данной задачи. Траектория — линия, вдоль которой движется тело.
              </p>
              <p>
                <strong>Равномерное прямолинейное движение:</strong> Скорость постоянна (v = const). Путь: s = v · t.
              </p>
              <p>
                <strong>Равноускоренное прямолинейное движение:</strong> Ускорение постоянно (a = const). Скорость: v(t) = v₀ + at. Перемещение: s = v₀t + at²/2.
              </p>
              <p>
                <strong>Движение по окружности:</strong> Центростремительное ускорение a_цс = v² / R = ω² · R. Период обращения T = 2π / ω = 2πR / v.
              </p>
            </div>
            <div className="mt-8 flex justify-end">
              <button
                onClick={() => setShowTheoryModal(false)}
                className="px-6 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors cursor-pointer"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
