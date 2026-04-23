// ================================================================
//  LifeAI — AI Life Manager
//  app.js  |  Object-Oriented Architecture
//
//  Class Hierarchy:
//
//  Observable (base)
//    └── BaseModel
//          ├── TrackedItem          (abstract)
//          │     ├── Habit
//          │     └── Goal
//          │           └── Milestone
//          ├── CalendarEvent
//          ├── HealthMetrics
//          ├── SmartDevice          (abstract)
//          │     ├── LightDevice
//          │     ├── ThermostatDevice
//          │     └── SpeakerDevice
//          └── User
//
//  Manager / Controller classes:
//    UIManager, ModalManager, ToastManager,
//    ChatManager, ScheduleManager, DashboardManager
//
//  Principles applied:
//    ✅ Encapsulation  — private fields (#), getters/setters
//    ✅ Inheritance    — extends + super()
//    ✅ Polymorphism   — getStatus(), render(), toJSON()
//    ✅ Abstraction    — abstract base methods throw errors
// ================================================================


// ════════════════════════════════════════════
//  OBSERVABLE — Simple event emitter (base)
// ════════════════════════════════════════════
class Observable {
  #listeners = {};

  on(event, callback) {
    if (!this.#listeners[event]) this.#listeners[event] = [];
    this.#listeners[event].push(callback);
    return this; // fluent API
  }

  emit(event, data) {
    (this.#listeners[event] || []).forEach(cb => cb(data));
  }
}


// ════════════════════════════════════════════
//  BASE MODEL — Shared identity for all models
// ════════════════════════════════════════════
class BaseModel extends Observable {
  #id;
  #createdAt;

  constructor() {
    super();
    this.#id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.#createdAt = new Date();
  }

  get id()        { return this.#id; }
  get createdAt() { return this.#createdAt; }

  // Abstract — must be overridden
  toJSON() {
    throw new Error(`${this.constructor.name}.toJSON() must be implemented`);
  }
}


// ════════════════════════════════════════════
//  MILESTONE — Part of Goal
// ════════════════════════════════════════════
class Milestone extends BaseModel {
  #text;
  #done;

  constructor(text, done = false) {
    super();
    this.#text = text;
    this.#done = done;
  }

  get text() { return this.#text; }
  get done() { return this.#done; }

  toggle() {
    this.#done = !this.#done;
    this.emit('change', this);
    return this.#done;
  }

  toJSON() {
    return { text: this.#text, done: this.#done };
  }
}


// ════════════════════════════════════════════
//  TRACKED ITEM — Abstract base for Habit & Goal
// ════════════════════════════════════════════
class TrackedItem extends BaseModel {
  #name;
  #emoji;

  constructor(name, emoji) {
    super();
    if (new.target === TrackedItem) {
      throw new Error('TrackedItem is abstract and cannot be instantiated directly');
    }
    this.#name  = name;
    this.#emoji = emoji;
  }

  get name()  { return this.#name; }
  get emoji() { return this.#emoji; }

  set name(v) {
    if (!v || v.trim() === '') throw new Error('Name cannot be empty');
    this.#name = v.trim();
  }

  // Abstract — subclasses must implement
  getProgress() {
    throw new Error(`${this.constructor.name}.getProgress() must be implemented`);
  }

  // Polymorphic — each subclass renders differently
  render() {
    throw new Error(`${this.constructor.name}.render() must be implemented`);
  }
}


// ════════════════════════════════════════════
//  HABIT — extends TrackedItem
// ════════════════════════════════════════════
class Habit extends TrackedItem {
  #streak;
  #checks; // boolean[7] — Mon–Sun

  constructor({ name, emoji, streak = 0, checks = [0,0,0,0,0,0,0] }) {
    super(name, emoji);
    this.#streak = streak;
    this.#checks = [...checks];
  }

  get streak()  { return this.#streak; }
  get checks()  { return [...this.#checks]; } // defensive copy

  // Encapsulated mutation
  toggleDay(dayIndex) {
    if (dayIndex < 0 || dayIndex > 6) throw new RangeError('Day index must be 0–6');
    this.#checks[dayIndex] = this.#checks[dayIndex] ? 0 : 1;
    if (this.#checks[dayIndex]) this.#streak++;
    this.emit('change', this);
    return this.#checks[dayIndex];
  }

  // Polymorphic override
  getProgress() {
    const done = this.#checks.filter(Boolean).length;
    return Math.round((done / 7) * 100);
  }

  // Polymorphic render — returns HTML string
  render(index) {
    const pct = this.getProgress();
    const checksHTML = this.#checks.map((c, i) =>
      `<div class="habit-check ${c ? 'done' : ''}"
            onclick="app.habitManager.toggleDay(${index}, ${i})">${c ? '✓' : ''}</div>`
    ).join('');

    return `
      <div class="habit-row" data-habit-id="${this.id}">
        <div class="habit-emoji">${this.emoji}</div>
        <div class="habit-info">
          <div class="habit-name">${this.name}</div>
          <div class="habit-streak">🔥 ${this.#streak} day streak</div>
          <div class="habit-checks">${checksHTML}</div>
        </div>
        <div class="habit-pct">${pct}%</div>
        <div class="habit-delete" onclick="app.habitManager.delete(${index})" title="Delete habit">✕</div>
      </div>`;
  }

  toJSON() {
    return {
      name:   this.name,
      emoji:  this.emoji,
      streak: this.#streak,
      checks: this.#checks,
    };
  }
}


// ════════════════════════════════════════════
//  GOAL — extends TrackedItem
// ════════════════════════════════════════════
class Goal extends TrackedItem {
  #dueDate;
  #category;
  #color;
  #tagClass;
  #tagText;
  #milestones; // Milestone[]

  constructor({ title, emoji, dueDate = '', category = 'Personal',
                color = 'var(--accent)', tagClass = 'tag-purple', tagText = 'New',
                milestones = [] }) {
    super(title, emoji);
    this.#dueDate    = dueDate;
    this.#category   = category;
    this.#color      = color;
    this.#tagClass   = tagClass;
    this.#tagText    = tagText;
    this.#milestones = milestones.map(m =>
      m instanceof Milestone ? m : new Milestone(m.text, m.done)
    );
  }

  get dueDate()    { return this.#dueDate; }
  get category()   { return this.#category; }
  get color()      { return this.#color; }
  get tagClass()   { return this.#tagClass; }
  get tagText()    { return this.#tagText; }
  get milestones() { return [...this.#milestones]; }

  get dateLabel() {
    if (!this.#dueDate) return `${this.#category} Goal`;
    return `Due: ${new Date(this.#dueDate).toLocaleDateString('en-US',
      { month:'long', day:'numeric', year:'numeric' })} · ${this.#category}`;
  }

  addMilestone(text) {
    const ms = new Milestone(text, false);
    this.#milestones.push(ms);
    this.emit('change', this);
    return ms;
  }

  toggleMilestone(index) {
    if (index < 0 || index >= this.#milestones.length) throw new RangeError('Invalid milestone index');
    const result = this.#milestones[index].toggle();
    this.emit('change', this);
    return result;
  }

  // Polymorphic override
  getProgress() {
    if (this.#milestones.length === 0) return 0;
    const done = this.#milestones.filter(m => m.done).length;
    return Math.round((done / this.#milestones.length) * 100);
  }

  // Polymorphic render
  render(index) {
    const pct = this.getProgress();
    const milestonesHTML = this.#milestones.map((m, mi) => `
      <div class="milestone" onclick="app.goalManager.toggleMilestone(${index}, ${mi})">
        <div class="ms-check ${m.done ? 'done' : ''}">${m.done ? '✓' : '·'}</div>
        <span style="${m.done ? 'text-decoration:line-through;opacity:0.5' : ''}">${m.text}</span>
      </div>`).join('');

    return `
      <div class="goal-card" data-goal-id="${this.id}">
        <div class="goal-top">
          <div class="goal-icon" style="background:rgba(99,102,241,0.1)">${this.emoji}</div>
          <div class="goal-meta">
            <div class="goal-title">${this.name}</div>
            <div class="goal-date">${this.dateLabel}</div>
            <div class="progress-bar" style="margin-top:10px">
              <div class="progress-fill" style="width:${pct}%;background:${this.#color}"></div>
            </div>
          </div>
          <div>
            <div class="goal-pct" style="color:${this.#color}">${pct}%</div>
            <span class="tag ${this.#tagClass}" style="margin-top:6px;display:inline-flex">${this.#tagText}</span>
          </div>
        </div>
        <div class="milestones">${milestonesHTML}</div>
        <div class="goal-actions">
          <button class="btn btn-ghost btn-sm" onclick="app.goalManager.promptAddMilestone(${index})">+ Add Milestone</button>
          <button class="btn btn-danger btn-sm" onclick="app.goalManager.delete(${index})">✕ Remove</button>
        </div>
      </div>`;
  }

  toJSON() {
    return {
      title:      this.name,
      emoji:      this.emoji,
      dueDate:    this.#dueDate,
      category:   this.#category,
      color:      this.#color,
      tagClass:   this.#tagClass,
      tagText:    this.#tagText,
      milestones: this.#milestones.map(m => m.toJSON()),
    };
  }
}


// ════════════════════════════════════════════
//  CALENDAR EVENT
// ════════════════════════════════════════════
class CalendarEvent extends BaseModel {
  #title;
  #day;     // 0=Mon … 6=Sun
  #hour;    // 7–21
  #category;

  static CATEGORY_COLORS = {
    purple: 'var(--accent)',
    teal:   'var(--teal)',
    coral:  'var(--coral)',
    amber:  'var(--amber)',
    green:  'var(--green)',
  };

  constructor({ title, day, hour, category = 'purple' }) {
    super();
    this.#title    = title;
    this.#day      = day;
    this.#hour     = hour;
    this.#category = category;
  }

  get title()    { return this.#title; }
  get day()      { return this.#day; }
  get hour()     { return this.#hour; }
  get category() { return this.#category; }
  get color()    { return CalendarEvent.CATEGORY_COLORS[this.#category] || 'var(--accent)'; }

  // Polymorphic — different display for calendar vs timeline
  render() {
    return `<div class="cal-event ${this.#category}" data-event-id="${this.id}">${this.#title}</div>`;
  }

  renderTimeline() {
    return `
      <div class="timeline-item">
        <div class="t-time">${String(this.#hour).padStart(2,'0')}:00</div>
        <div class="timeline-dot" style="background:${this.color}"></div>
        <div class="t-body">
          <div class="t-title">${this.#title}</div>
        </div>
        <span class="tag tag-purple">Event</span>
      </div>`;
  }

  toJSON() {
    return {
      title:    this.#title,
      day:      this.#day,
      hour:     this.#hour,
      category: this.#category,
    };
  }
}


// ════════════════════════════════════════════
//  HEALTH METRICS — Encapsulated health data
// ════════════════════════════════════════════
class HealthMetrics extends BaseModel {
  #steps;
  #stepsGoal;
  #waterCups;
  #waterGoal;
  #heartRate;
  #sleepHours;

  constructor({ steps = 8420, stepsGoal = 10000,
                waterCups = 6, waterGoal = 10,
                heartRate = 72, sleepHours = 7.2 } = {}) {
    super();
    this.#steps      = steps;
    this.#stepsGoal  = stepsGoal;
    this.#waterCups  = waterCups;
    this.#waterGoal  = waterGoal;
    this.#heartRate  = heartRate;
    this.#sleepHours = sleepHours;
  }

  // Getters
  get steps()      { return this.#steps; }
  get stepsGoal()  { return this.#stepsGoal; }
  get waterCups()  { return this.#waterCups; }
  get waterLiters(){ return (this.#waterCups * 0.25).toFixed(1); }
  get heartRate()  { return this.#heartRate; }
  get sleepHours() { return this.#sleepHours; }
  get stepsPercent(){ return Math.min(100, Math.round((this.#steps / this.#stepsGoal) * 100)); }

  // Encapsulated mutations with validation
  addSteps(delta) {
    this.#steps = Math.max(0, Math.min(25000, this.#steps + delta));
    this.emit('stepsChange', this.#steps);
    return this.#steps;
  }

  setWaterCups(cups) {
    this.#waterCups = Math.max(0, Math.min(this.#waterGoal, cups));
    this.emit('waterChange', this.#waterCups);
    return this.#waterCups;
  }

  syncHeartRate() {
    this.#heartRate = 70 + Math.floor(Math.random() * 10);
    this.emit('heartRateChange', this.#heartRate);
    return this.#heartRate;
  }

  toJSON() {
    return {
      steps: this.#steps, stepsGoal: this.#stepsGoal,
      waterCups: this.#waterCups, heartRate: this.#heartRate,
      sleepHours: this.#sleepHours,
    };
  }
}


// ════════════════════════════════════════════
//  SMART DEVICE — Abstract base
// ════════════════════════════════════════════
class SmartDevice extends BaseModel {
  #name;
  #icon;
  #isOn;

  constructor(name, icon, isOn = false) {
    super();
    if (new.target === SmartDevice) {
      throw new Error('SmartDevice is abstract');
    }
    this.#name = name;
    this.#icon = icon;
    this.#isOn = isOn;
  }

  get name() { return this.#name; }
  get icon() { return this.#icon; }
  get isOn() { return this.#isOn; }

  toggle() {
    this.#isOn = !this.#isOn;
    this.emit('toggle', { device: this, isOn: this.#isOn });
    return this.#isOn;
  }

  // Abstract — each device has its own status string
  getStatus() {
    throw new Error(`${this.constructor.name}.getStatus() must be implemented`);
  }

  // Shared render with polymorphic getStatus()
  render(domId) {
    return `
      <div class="device-card" id="dev-${domId}" data-device-id="${this.id}">
        <div class="device-icon">${this.#icon}</div>
        <div class="device-info">
          <div class="device-name">${this.#name}</div>
          <div class="device-status" id="${domId}-status">${this.getStatus()}</div>
        </div>
        <div class="device-action">
          ${this.renderControls(domId)}
        </div>
      </div>`;
  }

  // Can be overridden for custom controls
  renderControls(domId) {
    return `
      <label class="toggle">
        <input type="checkbox" ${this.#isOn ? 'checked' : ''}
               onchange="app.deviceManager.toggle('${this.id}')">
        <span class="toggle-slider"></span>
      </label>`;
  }

  toJSON() {
    return { name: this.#name, icon: this.#icon, isOn: this.#isOn };
  }
}


// ════════════════════════════════════════════
//  LIGHT DEVICE — extends SmartDevice
// ════════════════════════════════════════════
class LightDevice extends SmartDevice {
  #brightness;
  #colorTemp; // 'warm' | 'cool' | 'daylight'

  constructor(name, { brightness = 40, colorTemp = 'warm', isOn = true } = {}) {
    super(name, '💡', isOn);
    this.#brightness = brightness;
    this.#colorTemp  = colorTemp;
  }

  get brightness() { return this.#brightness; }

  setBrightness(val) {
    this.#brightness = Math.max(0, Math.min(100, val));
    this.emit('change', this);
  }

  // Polymorphic override
  getStatus() {
    if (!this.isOn) return 'Off';
    return `${this.#colorTemp.charAt(0).toUpperCase() + this.#colorTemp.slice(1)} white · ${this.#brightness}% brightness`;
  }

  toJSON() {
    return { ...super.toJSON(), brightness: this.#brightness, colorTemp: this.#colorTemp };
  }
}


// ════════════════════════════════════════════
//  THERMOSTAT DEVICE — extends SmartDevice
// ════════════════════════════════════════════
class ThermostatDevice extends SmartDevice {
  #temperature;
  #mode;

  constructor(name, { temperature = 22, mode = 'Auto', isOn = true } = {}) {
    super(name, '🌡️', isOn);
    this.#temperature = temperature;
    this.#mode        = mode;
  }

  get temperature() { return this.#temperature; }

  adjustTemp(delta) {
    this.#temperature = Math.max(16, Math.min(30, this.#temperature + delta));
    this.emit('change', this);
    return this.#temperature;
  }

  // Polymorphic override
  getStatus() {
    return this.isOn ? `${this.#temperature}°C · ${this.#mode} mode` : 'Off';
  }

  // Override to add +/- controls
  renderControls(domId) {
    return `
      <div style="display:flex;align-items:center;gap:6px">
        <button class="step-btn" onclick="app.deviceManager.adjustTemp(-1)">−</button>
        <span id="tempDisplay" style="font-family:var(--font-head);font-weight:700;font-size:14px;min-width:30px;text-align:center">${this.#temperature}°</span>
        <button class="step-btn" onclick="app.deviceManager.adjustTemp(1)">+</button>
        ${super.renderControls(domId)}
      </div>`;
  }

  toJSON() {
    return { ...super.toJSON(), temperature: this.#temperature, mode: this.#mode };
  }
}


// ════════════════════════════════════════════
//  SPEAKER DEVICE — extends SmartDevice
// ════════════════════════════════════════════
class SpeakerDevice extends SmartDevice {
  #volume;

  constructor(name, { volume = 40, isOn = false } = {}) {
    super(name, '🔔', isOn);
    this.#volume = volume;
  }

  get volume() { return this.#volume; }

  setVolume(val) {
    this.#volume = Math.max(0, Math.min(100, val));
    this.emit('change', this);
    return this.#volume;
  }

  // Polymorphic override
  getStatus() {
    return this.isOn ? `Playing · Volume ${this.#volume}%` : `Idle · Volume ${this.#volume}%`;
  }

  // Override to add volume slider
  renderControls(domId) {
    return `
      <div style="display:flex;align-items:center;gap:8px">
        <input type="range" min="0" max="100" value="${this.#volume}"
               style="width:60px;accent-color:var(--accent)"
               oninput="app.deviceManager.setSpeakerVol(this.value)">
        ${super.renderControls(domId)}
      </div>`;
  }

  toJSON() {
    return { ...super.toJSON(), volume: this.#volume };
  }
}


// ════════════════════════════════════════════
//  USER — Encapsulated user profile
// ════════════════════════════════════════════
class User extends BaseModel {
  #name;
  #initials;
  #plan;
  #email;

  constructor({ name = 'Hanan', initials = 'HN', plan = 'Pro', email = 'hanan@example.com' } = {}) {
    super();
    this.#name     = name;
    this.#initials = initials;
    this.#plan     = plan;
    this.#email    = email;
  }

  get name()     { return this.#name; }
  get initials() { return this.#initials; }
  get plan()     { return this.#plan; }
  get email()    { return this.#email; }

  setName(name)       { this.#name = name; }
  setInitials(value)  { this.#initials = value; }
  setPlan(value)      { this.#plan = value; }
  setEmail(value)     { this.#email = value; }

  getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return { text: `Good morning, ${this.#name}`, icon: '☀️' };
    if (h < 17) return { text: `Good afternoon, ${this.#name}`, icon: '⛅' };
    return { text: `Good evening, ${this.#name}`, icon: '🌙' };
  }

  toJSON() {
    return { name: this.#name, initials: this.#initials, plan: this.#plan, email: this.#email };
  }
}


// ════════════════════════════════════════════
//  HABIT MANAGER — manages Habit collection
// ════════════════════════════════════════════
class HabitManager extends Observable {
  #habits = [];

  constructor(initialData = []) {
    super();
    this.#habits = initialData.map(d => new Habit(d));
  }

  get habits() { return [...this.#habits]; }
  get count()  { return this.#habits.length; }

  add(habitData) {
    const habit = new Habit(habitData);
    this.#habits.push(habit);
    this.emit('change', this.#habits);
    return habit;
  }

  delete(index) {
    if (index < 0 || index >= this.#habits.length) throw new RangeError('Invalid habit index');
    const removed = this.#habits.splice(index, 1)[0];
    this.emit('change', this.#habits);
    return removed;
  }

  toggleDay(habitIndex, dayIndex) {
    const habit = this.#habits[habitIndex];
    if (!habit) throw new RangeError('Invalid habit index');
    const result = habit.toggleDay(dayIndex);
    this.emit('change', this.#habits);
    return result;
  }

  getCompletionRate() {
    const total    = this.#habits.reduce((s, h) => s + h.checks.filter(Boolean).length, 0);
    const possible = this.#habits.length * 7;
    return possible ? Math.round((total / possible) * 100) : 0;
  }

  getLongestStreak() {
    if (!this.#habits.length) return null;
    return this.#habits.reduce((a, b) => a.streak > b.streak ? a : b);
  }

  render() {
    const container = document.getElementById('habitList');
    if (!container) return;
    container.innerHTML = this.#habits.map((h, i) => h.render(i)).join('');
    this.#updateStats();
    app.dashboardManager.renderTopHabits(this.#habits);
  }

  #updateStats() {
    const rate    = this.getCompletionRate();
    const best    = this.getLongestStreak();
    const perfect = this.#habits.filter(h => h.checks.every(Boolean)).length;

    document.getElementById('habitCompRate').textContent  = rate + '%';
    document.getElementById('habitCompBar').style.width   = rate + '%';
    document.getElementById('statHabitRate').textContent  = rate;
    document.getElementById('statHabits').textContent     = this.#habits.length;

    if (best) {
      document.getElementById('longestStreak').textContent     = best.streak + ' days 🔥';
      document.getElementById('longestStreakName').textContent  = best.name;
    }
  }
}


// ════════════════════════════════════════════
//  GOAL MANAGER
// ════════════════════════════════════════════
class GoalManager extends Observable {
  #goals = [];

  constructor(initialData = []) {
    super();
    this.#goals = initialData.map(d => new Goal(d));
  }

  get goals() { return [...this.#goals]; }

  add(goalData) {
    const goal = new Goal(goalData);
    this.#goals.push(goal);
    this.emit('change', this.#goals);
    return goal;
  }

  delete(index) {
    if (index < 0 || index >= this.#goals.length) throw new RangeError('Invalid goal index');
    const removed = this.#goals.splice(index, 1)[0];
    this.emit('change', this.#goals);
    return removed;
  }

  toggleMilestone(goalIndex, msIndex) {
    const goal = this.#goals[goalIndex];
    if (!goal) throw new RangeError('Invalid goal index');
    goal.toggleMilestone(msIndex);
    this.emit('change', this.#goals);
  }

  promptAddMilestone(index) {
    const text = prompt('New milestone:');
    if (!text) return;
    this.#goals[index].addMilestone(text);
    this.render();
    app.toast.show('Milestone added!', 'success');
  }

  render() {
    const container = document.getElementById('goalsList');
    if (!container) return;
    container.innerHTML = this.#goals.map((g, i) => g.render(i)).join('');
  }
}


// ════════════════════════════════════════════
//  SCHEDULE MANAGER
// ════════════════════════════════════════════
class ScheduleManager extends Observable {
  #events    = [];
  #weekOffset = 0;
  #hours      = [7,8,9,10,11,12,13,14,15,16,17,18,19,20,21];
  #weekDays   = ['MON','TUE','WED','THU','FRI','SAT','SUN'];

  constructor(initialEvents = []) {
    super();
    this.#events = initialEvents.map(e => new CalendarEvent(e));
  }

  get events() { return [...this.#events]; }

  addEvent(eventData) {
    const event = new CalendarEvent(eventData);
    this.#events.push(event);
    this.emit('eventAdded', event);
    return event;
  }

  getTodayEvents() {
    const today = new Date();
    const todayDayIdx = today.getDay() === 0 ? 6 : today.getDay() - 1;
    return this.#events
      .filter(e => e.day === todayDayIdx)
      .sort((a, b) => a.hour - b.hour);
  }

  navigateWeek(dir) {
    this.#weekOffset = dir === 0 ? 0 : this.#weekOffset + dir;
    this.render();
  }

  render() {
    this.#renderHeader();
    this.#renderGrid();
  }

  #renderHeader() {
    const header = document.getElementById('calHeader');
    if (!header) return;
    header.innerHTML = '<div style="height:48px"></div>';

    const today      = new Date();
    const dayOfWeek  = today.getDay() === 0 ? 6 : today.getDay() - 1;
    const startDate  = new Date(today);
    startDate.setDate(today.getDate() - dayOfWeek + (this.#weekOffset * 7));

    this.#weekDays.forEach((d, i) => {
      const date    = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const isToday = date.toDateString() === today.toDateString();
      const col     = document.createElement('div');
      col.className = 'day-col' + (isToday ? ' today' : '');
      col.innerHTML = `<div class="day-name">${d}</div><div class="day-num">${date.getDate()}</div>`;
      header.appendChild(col);
    });

    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    const label = document.getElementById('schedWeekLabel');
    if (label) {
      label.textContent = `Week of ${startDate.toLocaleDateString('en-US',
        {month:'long', day:'numeric'})} – ${endDate.toLocaleDateString('en-US',
        {month:'long', day:'numeric', year:'numeric'})}`;
    }
  }

  #renderGrid() {
    const grid = document.getElementById('calGrid');
    if (!grid) return;
    grid.innerHTML = '';

    this.#hours.forEach(h => {
      const lbl = document.createElement('div');
      lbl.className = 'hour-label';
      lbl.textContent = h + ':00';
      grid.appendChild(lbl);

      for (let d = 0; d < 7; d++) {
        const cell = document.createElement('div');
        cell.className = 'cal-cell';
        cell.title     = `Add event at ${h}:00`;
        cell.onclick   = () => app.modalManager.openWithDefaults('event', { hour: h });

        const ev = this.#events.find(e => e.day === d && e.hour === h);
        if (ev) {
          const evEl = document.createElement('div');
          evEl.className = `cal-event ${ev.category}`;
          evEl.textContent = ev.title;
          evEl.onclick = (e) => { e.stopPropagation(); app.toast.show(`📅 ${ev.title}`, 'info'); };
          cell.appendChild(evEl);
        }
        grid.appendChild(cell);
      }
    });
  }
}


// ════════════════════════════════════════════
//  DEVICE MANAGER
// ════════════════════════════════════════════
class DeviceManager extends Observable {
  #devices   = new Map(); // id → SmartDevice
  #thermostat;
  #speaker;

  constructor() {
    super();
    // Pre-build known devices
    const lights  = new LightDevice('Smart Bedroom Lights', { isOn: true });
    this.#thermostat = new ThermostatDevice('Smart Thermostat', { isOn: true });
    this.#speaker    = new SpeakerDevice('Smart Speaker', { isOn: false });

    [lights, this.#thermostat, this.#speaker].forEach(d => this.#devices.set(d.id, d));
  }

  addDevice(name, DeviceClass, options = {}) {
    const device = new DeviceClass(name, options);
    this.#devices.set(device.id, device);
    this.emit('deviceAdded', device);
    return device;
  }

  toggle(deviceId) {
    const device = this.#devices.get(deviceId);
    if (!device) return;
    const isOn = device.toggle();
    app.toast.show(`${device.name} turned ${isOn ? 'ON 🟢' : 'OFF 🔴'}`, isOn ? 'success' : 'info');
    // Update status text in DOM
    const statusEl = document.querySelector(`[data-device-id="${deviceId}"] .device-status`);
    if (statusEl) statusEl.textContent = device.getStatus();
  }

  adjustTemp(delta) {
    if (!this.#thermostat) return;
    const temp = this.#thermostat.adjustTemp(delta);
    const display = document.getElementById('tempDisplay');
    const status  = document.getElementById('thermo-status');
    if (display) display.textContent = temp + '°';
    if (status)  status.textContent  = this.#thermostat.getStatus();
    app.toast.show(`🌡️ Thermostat set to ${temp}°C`, 'info');
  }

  setSpeakerVol(val) {
    if (!this.#speaker) return;
    this.#speaker.setVolume(parseInt(val));
    const status = document.getElementById('speaker-status');
    if (status) status.textContent = this.#speaker.getStatus();
  }

  syncAll() {
    app.toast.show('🔄 Syncing devices…', 'info');
    setTimeout(() => {
      const newHR = app.healthMetrics.syncHeartRate();
      const hrEl  = document.getElementById('heartRate');
      if (hrEl) hrEl.textContent = newHR;
      app.toast.show('✅ Devices synced successfully!', 'success');
    }, 1500);
  }
}


// ════════════════════════════════════════════
//  TOAST MANAGER
// ════════════════════════════════════════════
class ToastManager {
  #container;

  constructor(containerId = 'toastContainer') {
    this.#container = document.getElementById(containerId);
  }

  show(message, type = 'info') {
    const toast       = document.createElement('div');
    toast.className   = `toast ${type}`;
    toast.innerHTML   = `<span>${message}</span>`;
    this.#container.appendChild(toast);

    setTimeout(() => {
      toast.style.cssText += 'opacity:0;transform:translateX(20px);transition:all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}


// ════════════════════════════════════════════
//  MODAL MANAGER
// ════════════════════════════════════════════
class ModalManager {
  #selectedHabitEmoji = '📝';
  #selectedGoalEmoji  = '🎯';

  open(type) {
    document.getElementById(`modal-${type}`)?.classList.add('open');
  }

  openWithDefaults(type, defaults = {}) {
    if (type === 'event') {
      document.getElementById('evDate').value  = defaults.date  || new Date().toISOString().split('T')[0];
      document.getElementById('evTime').value  = defaults.hour  ? `${String(defaults.hour).padStart(2,'0')}:00` : '';
      document.getElementById('evTitle').value = '';
    }
    this.open(type);
  }

  close(type) {
    document.getElementById(`modal-${type}`)?.classList.remove('open');
  }

  closeOnBackground(event, type) {
    if (event.target === document.getElementById(`modal-${type}`)) this.close(type);
  }

  selectHabitEmoji(el, emoji) {
    this.#selectedHabitEmoji = emoji;
    document.querySelectorAll('#emojiPicker .emoji-opt').forEach(e => e.classList.remove('selected'));
    el.classList.add('selected');
  }

  selectGoalEmoji(el, emoji) {
    this.#selectedGoalEmoji = emoji;
    document.querySelectorAll('#goalEmojiPicker .emoji-opt').forEach(e => e.classList.remove('selected'));
    el.classList.add('selected');
  }

  // ── Save handlers ──
  saveEvent() {
    const title = document.getElementById('evTitle').value.trim();
    const date  = document.getElementById('evDate').value;
    const time  = document.getElementById('evTime').value;
    const cat   = document.getElementById('evCat').value;

    if (!title || !date || !time) { app.toast.show('Please fill in all required fields', 'error'); return; }

    const d          = new Date(date);
    const dayOfWeek  = d.getDay() === 0 ? 6 : d.getDay() - 1;
    const hour       = parseInt(time.split(':')[0]);

    const event = app.scheduleManager.addEvent({ title, day: dayOfWeek, hour, category: cat });
    app.scheduleManager.render();

    // If today, update dashboard timeline too
    if (date === new Date().toISOString().split('T')[0]) {
      app.dashboardManager.renderTimeline();
      document.getElementById('schedBadge').textContent = app.scheduleManager.events.length;
    }

    this.close('event');
    app.toast.show(`📅 "${title}" added to your schedule!`, 'success');
  }

  saveHabit() {
    const name = document.getElementById('habitName').value.trim();
    if (!name) { app.toast.show('Please enter a habit name', 'error'); return; }

    app.habitManager.add({ name, emoji: this.#selectedHabitEmoji, streak: 0, checks: [0,0,0,0,0,0,0] });
    app.habitManager.render();
    this.close('habit');
    document.getElementById('habitName').value = '';
    app.toast.show(`⚡ "${name}" habit added!`, 'success');
  }

  saveGoal() {
    const title = document.getElementById('goalTitle').value.trim();
    if (!title) { app.toast.show('Please enter a goal title', 'error'); return; }

    const due = document.getElementById('goalDue').value;
    const cat = document.getElementById('goalCat').value;
    const ms  = document.getElementById('goalMilestone').value.trim();

    app.goalManager.add({
      title, emoji: this.#selectedGoalEmoji,
      dueDate: due, category: cat,
      milestones: ms ? [{ text: ms, done: false }] : [{ text: 'Get started!', done: false }],
    });
    app.goalManager.render();
    this.close('goal');
    document.getElementById('goalTitle').value     = '';
    document.getElementById('goalMilestone').value = '';
    app.toast.show(`🎯 "${title}" goal created!`, 'success');
  }

  saveMeal() {
    const name = document.getElementById('mealName').value.trim();
    const cals = parseInt(document.getElementById('mealCals').value) || 0;
    if (!name) { app.toast.show('Please enter meal name', 'error'); return; }

    const el  = document.getElementById('calsNutr');
    if (el) el.textContent = (parseInt(el.textContent.replace(',', '')) + cals).toLocaleString();
    this.close('nutrition');
    document.getElementById('mealName').value = '';
    document.getElementById('mealCals').value = '';
    app.toast.show(`🥗 "${name}" logged (${cals} kcal)!`, 'success');
  }

  saveDevice() {
    const name = document.getElementById('devName').value.trim();
    const type = document.getElementById('devType').value;
    if (!name) { app.toast.show('Please enter device name', 'error'); return; }

    const grid = document.getElementById('deviceGrid');
    const card = document.createElement('div');
    card.className = 'device-card';
    card.innerHTML = `
      <div class="device-icon">${type}</div>
      <div class="device-info">
        <div class="device-name">${name}</div>
        <div class="device-status">Connecting…</div>
      </div>
      <div class="device-action">
        <label class="toggle"><input type="checkbox" /><span class="toggle-slider"></span></label>
      </div>`;
    grid.appendChild(card);
    setTimeout(() => card.querySelector('.device-status').textContent = 'Connected ✓', 1500);

    this.close('device');
    document.getElementById('devName').value = '';
    app.toast.show(`📱 "${name}" connected!`, 'success');
  }

  saveAutomation() {
    const name = document.getElementById('autoName').value.trim();
    const desc = document.getElementById('autoDesc').value.trim();
    if (!name) { app.toast.show('Please enter rule name', 'error'); return; }

    const colors = ['var(--teal)', 'var(--accent)', 'var(--amber)', 'var(--pink)'];
    const col    = colors[Math.floor(Math.random() * colors.length)];
    const list   = document.getElementById('automationList');
    list.innerHTML += `
      <div class="timeline-item">
        <div class="timeline-dot" style="background:${col}"></div>
        <div class="t-body">
          <div class="t-title">${name}</div>
          <div class="t-sub">${desc || 'Custom automation rule'}</div>
        </div>
        <span class="tag tag-green">Active</span>
      </div>`;
    this.close('automation');
    document.getElementById('autoName').value = '';
    document.getElementById('autoDesc').value = '';
    app.toast.show(`⚡ Rule "${name}" created!`, 'success');
  }
}


// ════════════════════════════════════════════
//  DASHBOARD MANAGER
// ════════════════════════════════════════════
class DashboardManager {
  #insights = [
    "You've completed 6 of 7 habits this week — great streak! Your deep work sessions peak at 10 AM.",
    "Your sleep quality improved 12% this month. Keep your 22-day morning routine streak going!",
    "📊 Your productivity peaks on Tuesdays and Thursdays. Schedule your hardest tasks on those days.",
    "Hydration reminder: you typically drink less water on study days. Set hourly reminders!",
    "Your SPM project is 72% complete. At your current pace, you'll finish 3 days before the deadline!",
  ];
  #insightIdx = 0;

  renderGreeting() {
    const { text, icon } = app.user.getGreeting();
    const el = document.getElementById('greetingText');
    if (el) el.innerHTML = `${text.replace(app.user.name, `<span>${app.user.name}</span>`)} ${icon}`;
    const dateEl = document.getElementById('dashDate');
    if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-US',
      { weekday:'long', month:'long', day:'numeric', year:'numeric' }) + ' · Here\'s your day at a glance';
  }

  renderTimeline() {
    const container = document.getElementById('dashTimeline');
    if (!container) return;
    const events     = app.scheduleManager.getTodayEvents();
    const staticRows = [
      { time:'09:00', color:'var(--teal)',   title:'Morning workout 🏃', sub:'45 min · Gym',       tag:'tag-green',  tagText:'Done'    },
      { time:'11:00', color:'var(--accent)', title:'SPM Lecture',        sub:'90 min · Online',    tag:'tag-blue',   tagText:'Now'     },
      { time:'14:00', color:'var(--amber)',  title:'Data Mining Lab',    sub:'2 hrs · Lab 3',      tag:'tag-amber',  tagText:'Soon'    },
      { time:'18:00', color:'var(--pink)',   title:'Team standup',       sub:'30 min · Zoom',      tag:'tag-purple', tagText:'Meeting' },
      { time:'21:00', color:'var(--blue)',   title:'Reading 📚',         sub:'60 min',             tag:'tag-teal',   tagText:'Routine' },
    ];

    container.innerHTML = staticRows.map(ev => `
      <div class="timeline-item">
        <div class="t-time">${ev.time}</div>
        <div class="timeline-dot" style="background:${ev.color}"></div>
        <div class="t-body">
          <div class="t-title">${ev.title}</div>
          <div class="t-sub">${ev.sub}</div>
        </div>
        <span class="tag ${ev.tag}">${ev.tagText}</span>
      </div>`).join('') +
      events.map(e => e.renderTimeline()).join('');
  }

  renderTopHabits(habits) {
    const el = document.getElementById('topHabitsToday');
    if (!el) return;
    const todayIdx = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
    el.innerHTML = habits.slice(0, 3).map(h => {
      const done = h.checks[todayIdx];
      return `
        <div>
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
            <span style="color:var(--text2)">${h.emoji} ${h.name}</span>
            <span style="color:${done ? 'var(--green)' : 'var(--text3)'}">${done ? '✓' : '—'}</span>
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width:${h.getProgress()}%;background:var(--green)"></div></div>
        </div>`;
    }).join('');
  }

  renderActivityBar() {
    const acts   = [60, 80, 45, 100, 70, 55, 30];
    const colors = ['var(--accent)','var(--teal)','var(--accent2)','var(--accent)','var(--blue)','var(--amber)','var(--surface3)'];
    const bar    = document.getElementById('activityBar');
    if (!bar) return;
    bar.innerHTML = '';
    acts.forEach((v, i) => {
      const b = document.createElement('div');
      b.className  = 'bar';
      b.style.cssText = `height:${v}%;background:${colors[i]};opacity:${i === 3 ? 1 : 0.65}`;
      b.title = `${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i]}: ${v}% activity`;
      bar.appendChild(b);
    });
  }

  refreshInsight() {
    this.#insightIdx = (this.#insightIdx + 1) % this.#insights.length;
    const el = document.getElementById('dashInsight');
    if (!el) return;
    el.style.transition = 'opacity 0.2s';
    el.style.opacity    = '0';
    setTimeout(() => {
      el.textContent  = this.#insights[this.#insightIdx];
      el.style.opacity = '1';
    }, 200);
  }
}


// ════════════════════════════════════════════
//  HEALTH DISPLAY MANAGER
// ════════════════════════════════════════════
class HealthDisplayManager {
  renderWaterCups() {
    const el = document.getElementById('waterCups');
    if (!el) return;
    el.innerHTML = '';
    for (let i = 0; i < 10; i++) {
      const cup = document.createElement('div');
      cup.className = 'water-cup' + (i < app.healthMetrics.waterCups ? ' filled' : '');
      cup.textContent = '💧';
      cup.title = i < app.healthMetrics.waterCups ? 'Click to unlog' : 'Log a glass';
      cup.onclick = () => app.healthDisplay.toggleWater(i);
      el.appendChild(cup);
    }
    const waterVal = document.getElementById('waterVal');
    if (waterVal) waterVal.textContent = app.healthMetrics.waterLiters + 'L';
  }

  toggleWater(idx) {
    const current = app.healthMetrics.waterCups;
    const newVal  = idx < current ? idx : idx + 1;
    app.healthMetrics.setWaterCups(newVal);
    this.renderWaterCups();
    app.toast.show(`💧 Water logged: ${app.healthMetrics.waterLiters}L`, 'success');
  }

  updateSteps() {
    const stepsEl = document.getElementById('stepsVal');
    const barEl   = document.getElementById('stepsBar');
    if (stepsEl) stepsEl.textContent       = app.healthMetrics.steps.toLocaleString();
    if (barEl)   barEl.style.width         = app.healthMetrics.stepsPercent + '%';
  }
}


// ════════════════════════════════════════════
//  CHAT MANAGER — AI Assistant
// ════════════════════════════════════════════
class ChatManager {
  #history = [];

  get history() { return [...this.#history]; }

  #buildSystemPrompt() {
    const m = app.healthMetrics;
    return `You are an intelligent AI Life Manager assistant for ${app.user.name}. You help with:
- Schedule management (today: Morning workout 9am, SPM Lecture 11am, Data Mining Lab 2pm, Team standup 6pm)
- Habits tracking (${app.habitManager.habits.map(h => `${h.name}: ${h.streak}d streak`).join(', ')})
- Health metrics (Steps: ${m.steps.toLocaleString()}/${m.stepsGoal.toLocaleString()}, Water: ${m.waterLiters}L, Heart rate: ${m.heartRate}bpm, Sleep: ${m.sleepHours}h)
- Goals (${app.goalManager.goals.map(g => `${g.name}: ${g.getProgress()}%`).join(', ')})
Be concise, personal, warm, and actionable. Keep responses under 150 words unless detail is needed. Use occasional emojis. Address her as ${app.user.name}.`;
  }

  async send(userText) {
    if (!userText.trim()) return;

    const input   = document.getElementById('chatInput');
    const sendBtn = document.getElementById('chatSendBtn');

    this.#appendMessage('user', userText);
    this.#history.push({ role: 'user', content: userText });
    input.value = '';
    this.#autoResize(input);
    sendBtn.disabled = true;

    const typingId = this.#showTyping();

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          model:      'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system:     this.#buildSystemPrompt(),
          messages:   this.#history,
        }),
      });

      const data   = await response.json();
      const aiText = data.content?.map(c => c.text || '').join('') ||
                     'Sorry, I had trouble responding. Please try again.';

      document.getElementById(typingId)?.remove();
      this.#appendMessage('ai', aiText);
      this.#history.push({ role: 'assistant', content: aiText });

    } catch {
      // Mock AI responses for demo purposes
      document.getElementById(typingId)?.remove();
      const mockResponse = this.#getMockResponse(userText);
      this.#appendMessage('ai', mockResponse);
      this.#history.push({ role: 'assistant', content: mockResponse });
    }

    sendBtn.disabled = false;
    this.#scrollToBottom();
  }

  clear() {
    this.#history = [];
    const msgs = document.getElementById('chatMessages');
    if (msgs) msgs.innerHTML = '';
    this.#appendMessage('ai', `Chat cleared! How can I help you today, ${app.user.name}? 😊`);
  }

  useSuggestion(el) {
    document.getElementById('chatInput').value = el.textContent;
    this.send(el.textContent);
  }

  handleKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.send(document.getElementById('chatInput').value); }
  }

  #appendMessage(role, text) {
    const msgs = document.getElementById('chatMessages');
    if (!msgs) return;
    const div = document.createElement('div');
    div.className = `chat-msg ${role}`;
    div.innerHTML = `
      <div class="chat-avatar ${role}">${role === 'ai' ? '🤖' : app.user.initials}</div>
      <div class="chat-bubble">${text.replace(/\n/g, '<br>')}</div>`;
    msgs.appendChild(div);
    this.#scrollToBottom();
  }

  #showTyping() {
    const id   = 'typing-' + Date.now();
    const msgs = document.getElementById('chatMessages');
    if (!msgs) return id;
    msgs.innerHTML += `
      <div class="chat-msg ai" id="${id}">
        <div class="chat-avatar ai">🤖</div>
        <div class="chat-bubble">
          <div class="typing-indicator">
            <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>
          </div>
        </div>
      </div>`;
    this.#scrollToBottom();
    return id;
  }

  #scrollToBottom() {
    const msgs = document.getElementById('chatMessages');
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
  }

  #autoResize(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }

  #getMockResponse(userText) {
    const text = userText.toLowerCase();
    const user = app.user.name;

    if (text.includes('schedule') || text.includes('today')) {
      return `Good morning ${user}! Today you have: Morning workout at 9am, SPM Lecture at 11am, Data Mining Lab at 2pm, and Team standup at 6pm. You should leave for the gym in about 30 minutes. Have a productive day! 💪`;
    }

    if (text.includes('habit') || text.includes('habits')) {
      const habits = app.habitManager.habits;
      const goodHabits = habits.filter(h => h.streak > 5);
      const strugglingHabits = habits.filter(h => h.streak < 5);

      let response = `Your habits are looking ${goodHabits.length > strugglingHabits.length ? 'great' : 'mixed'} this week! `;

      if (goodHabits.length > 0) {
        response += `Strong performers: ${goodHabits.map(h => `${h.name} (${h.streak}d streak)`).join(', ')}. `;
      }

      if (strugglingHabits.length > 0) {
        response += `Could use attention: ${strugglingHabits.map(h => h.name).join(', ')}. `;
      }

      response += `Keep up the great work! 🌟`;
      return response;
    }

    if (text.includes('goal') || text.includes('goals')) {
      const goals = app.goalManager.goals;
      const completed = goals.filter(g => g.getProgress() === 100);
      const inProgress = goals.filter(g => g.getProgress() > 0 && g.getProgress() < 100);

      let response = `You're making excellent progress on your goals! `;

      if (completed.length > 0) {
        response += `Completed: ${completed.map(g => g.name).join(', ')}. `;
      }

      if (inProgress.length > 0) {
        response += `In progress: ${inProgress.map(g => `${g.name} (${g.getProgress()}%)`).join(', ')}. `;
      }

      response += `What's your focus for this week? 🎯`;
      return response;
    }

    if (text.includes('health') || text.includes('sleep') || text.includes('water') || text.includes('steps')) {
      const m = app.healthMetrics;
      return `Your health metrics look ${m.steps >= m.stepsGoal * 0.8 ? 'excellent' : 'good'} today! Steps: ${m.steps.toLocaleString()}/${m.stepsGoal.toLocaleString()}, Water: ${m.waterLiters}L, Heart rate: ${m.heartRate}bpm, Sleep: ${m.sleepHours}h. ${m.sleepHours < 7 ? 'Try to get more sleep tonight for better energy tomorrow! 😴' : 'Great job on your sleep! Keep it up! 🌙'}`;
    }

    // Default responses
    const responses = [
      `That's a great question, ${user}! I'm here to help you optimize your life. What specific aspect would you like to focus on - schedule, habits, health, or goals? 🤔`,
      `I love that you're being proactive about your well-being! Based on your current data, I'd recommend focusing on ${app.habitManager.habits.find(h => h.streak < 5)?.name || 'maintaining your strong habits'}. How can I support you with that? 💪`,
      `You're doing amazing work managing your life so effectively! Is there anything specific you'd like insights on, or would you like me to analyze your overall progress? 📊`,
      `Thanks for chatting with me, ${user}! I'm constantly learning about your patterns and preferences. What would make your day more productive or enjoyable? ✨`
    ];

    return responses[Math.floor(Math.random() * responses.length)];
  }
}


// ════════════════════════════════════════════
//  UI MANAGER — Navigation
// ════════════════════════════════════════════
class UIManager {
  navigate(pageId, navEl) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(`page-${pageId}`)?.classList.add('active');
    if (navEl) navEl.classList.add('active');

    // Update profile stats when navigating to profile
    if (pageId === 'profile') {
      app.profileManager.updateStats();
    }
  }
}


// ════════════════════════════════════════════
//  PROFILE MANAGER — manages profile page
// ════════════════════════════════════════════
class ProfileManager {
  updateStats() {
    const habitsCount = app.habitManager.habits.length;
    const goalsCount = app.goalManager.goals.length;
    const maxStreak = Math.max(...app.habitManager.habits.map(h => h.streak));
    const totalChecks = app.habitManager.habits.reduce((sum, h) => sum + h.checks.filter(Boolean).length, 0);
    const totalPossible = app.habitManager.habits.length * 7;
    const completionRate = totalPossible > 0 ? Math.round((totalChecks / totalPossible) * 100) : 0;

    document.getElementById('profileHabitsCount').textContent = habitsCount;
    document.getElementById('profileGoalsCount').textContent = goalsCount;
    document.getElementById('profileStreak').textContent = maxStreak;
    document.getElementById('profileCompletion').textContent = `${completionRate}%`;
    this.updateProfileDisplay();
  }

  updateProfileDisplay() {
    const name = app.user.name;
    const initials = app.user.initials || this._deriveInitials(name);
    const plan = app.user.plan;
    const email = app.user.email || '—';

    const profileNameEl = document.getElementById('profileName');
    const profileEmailEl = document.getElementById('profileEmail');
    const profilePlanTextEl = document.getElementById('profilePlanText');
    const profileAvatarEl = document.getElementById('profileAvatarLarge');
    const sidebarNameEl = document.getElementById('sidebarUserName');
    const sidebarPlanEl = document.getElementById('sidebarUserPlan');
    const sidebarAvatarEl = document.getElementById('sidebarAvatar');

    if (profileNameEl) profileNameEl.textContent = name;
    if (profileEmailEl) profileEmailEl.textContent = email;
    if (profilePlanTextEl) profilePlanTextEl.textContent = `${plan} Plan ✨`;
    if (profileAvatarEl) profileAvatarEl.textContent = initials;
    if (sidebarNameEl) sidebarNameEl.textContent = name;
    if (sidebarPlanEl) sidebarPlanEl.textContent = `${plan} Plan ✨`;
    if (sidebarAvatarEl) sidebarAvatarEl.textContent = initials;
  }

  populateProfileForm() {
    document.getElementById('profileNameInput').value = app.user.name;
    document.getElementById('profileInitialsInput').value = app.user.initials;
    document.getElementById('profileEmailInput').value = app.user.email || '';
    document.getElementById('profilePlanInput').value = app.user.plan;
  }

  saveProfile() {
    const nameEl = document.getElementById('profileNameInput');
    const initialsEl = document.getElementById('profileInitialsInput');
    const emailEl = document.getElementById('profileEmailInput');
    const planEl = document.getElementById('profilePlanInput');
    const name = nameEl?.value.trim() || '';
    const initials = initialsEl?.value.trim();
    const email = emailEl?.value.trim();
    const plan = planEl?.value || 'Pro';

    if (!name) {
      app.toast.show('Please enter your name before saving.', 'warning');
      return;
    }

    app.user.setName(name);
    app.user.setInitials(initials || this._deriveInitials(name));
    app.user.setEmail(email || '');
    app.user.setPlan(plan);

    this.updateStats();
    app.dashboardManager.renderGreeting();
    app.toast.show('Profile updated successfully.', 'success');
    app.modalManager.close('profile');
  }

  _deriveInitials(name) {
    return name.split(' ').map(part => part[0] || '').join('').slice(0, 2).toUpperCase();
  }
}


// ════════════════════════════════════════════
//  APP — Root application object
//       Composes all managers together
// ════════════════════════════════════════════
class LifeAIApp {
  constructor() {
    // Core models
    this.user          = new User({ name: 'Hanan', initials: 'HN', plan: 'Pro' });
    this.healthMetrics = new HealthMetrics();

    // Managers
    this.toast           = new ToastManager();
    this.modalManager    = new ModalManager();
    this.ui              = new UIManager();
    this.dashboardManager = new DashboardManager();
    this.healthDisplay   = new HealthDisplayManager();
    this.chatManager     = new ChatManager();
    this.profileManager  = new ProfileManager();

    // Data managers with initial seed data
    this.habitManager = new HabitManager([
      { emoji:'☀️', name:'Morning routine',   streak:22, checks:[1,1,1,1,1,1,0] },
      { emoji:'🏃', name:'Exercise',          streak:14, checks:[1,1,0,1,1,0,0] },
      { emoji:'📖', name:'Read 30 min',       streak:8,  checks:[1,1,1,1,0,0,0] },
      { emoji:'💧', name:'Drink 2.5L water',  streak:5,  checks:[1,0,1,1,1,0,0] },
      { emoji:'🧘', name:'Meditation',        streak:3,  checks:[0,1,1,1,0,0,0] },
      { emoji:'🌙', name:'Sleep by 11 PM',    streak:10, checks:[1,1,1,0,1,1,0] },
    ]);

    this.goalManager = new GoalManager([
      {
        title:'Complete AI Life Manager Project', emoji:'🎓',
        dueDate:'2026-05-15', category:'SPM Course',
        color:'var(--accent)', tagClass:'tag-blue', tagText:'On Track',
        milestones:[
          { done:true,  text:'UML Diagrams (Class, Use Case, Activity)' },
          { done:true,  text:'Requirements Specification Document' },
          { done:true,  text:'Risk Management Plan' },
          { done:false, text:'Sprint 2 – Backend API Development' },
          { done:false, text:'User Testing & Feedback' },
          { done:false, text:'Final Presentation & Submission' },
        ],
      },
      {
        title:'Build consistent fitness routine', emoji:'💪',
        dueDate:'', category:'Health Goal',
        color:'var(--teal)', tagClass:'tag-green', tagText:'Strong',
        milestones:[
          { done:true,  text:'Workout 4x per week for 1 month' },
          { done:true,  text:'Reach 10,000 avg daily steps' },
          { done:false, text:'Complete a 5K run' },
        ],
      },
      {
        title:'Data Science Certification', emoji:'📚',
        dueDate:'2026-08-01', category:'Personal',
        color:'var(--amber)', tagClass:'tag-amber', tagText:'In Progress',
        milestones:[
          { done:true,  text:'Complete Python for Data Science module' },
          { done:false, text:'Finish Machine Learning fundamentals' },
          { done:false, text:'Complete capstone project' },
          { done:false, text:'Pass certification exam' },
        ],
      },
    ]);

    this.scheduleManager = new ScheduleManager([
      { title:'Workout 🏃',      day:2, hour:9,  category:'teal'   },
      { title:'SPM Lecture',     day:2, hour:11, category:'purple' },
      { title:'Data Mining',     day:2, hour:14, category:'amber'  },
      { title:'Team standup',    day:2, hour:18, category:'coral'  },
      { title:'Project meeting', day:0, hour:10, category:'purple' },
      { title:'Library study',   day:1, hour:13, category:'teal'   },
      { title:'Office hours',    day:3, hour:9,  category:'coral'  },
      { title:'Code review',     day:4, hour:15, category:'amber'  },
    ]);

    this.deviceManager = new DeviceManager();
  }

  init() {
    this.dashboardManager.renderGreeting();
    this.dashboardManager.renderActivityBar();
    this.dashboardManager.renderTimeline();
    this.scheduleManager.render();
    this.habitManager.render();
    this.goalManager.render();
    this.healthDisplay.renderWaterCups();
  }
}


// ════════════════════════════════════════════
//  BOOTSTRAP — Create app & expose globals
//  (HTML onclick handlers need global access)
// ════════════════════════════════════════════
const app = new LifeAIApp();

document.addEventListener('DOMContentLoaded', () => app.init());

// ── Global bridge functions (called from HTML) ──
const nav             = (id, el)    => app.ui.navigate(id, el);
const openModal       = (t)         => { if (t === 'profile') app.profileManager.populateProfileForm(); app.modalManager.open(t); };
const closeModal      = (t)         => app.modalManager.close(t);
const closeModalBg    = (e, t)      => app.modalManager.closeOnBackground(e, t);
const selectEmoji     = (el, e)     => app.modalManager.selectHabitEmoji(el, e);
const selectGoalEmoji = (el, e)     => app.modalManager.selectGoalEmoji(el, e);
const saveEvent       = ()          => app.modalManager.saveEvent();
const saveHabit       = ()          => app.modalManager.saveHabit();
const saveGoal        = ()          => app.modalManager.saveGoal();
const saveMeal        = ()          => app.modalManager.saveMeal();
const saveDevice      = ()          => app.modalManager.saveDevice();
const saveAutomation  = ()          => app.modalManager.saveAutomation();
const saveProfile     = ()          => app.profileManager.saveProfile();
const refreshInsight  = ()          => app.dashboardManager.refreshInsight();
const navWeek         = (d)         => app.scheduleManager.navigateWeek(d);
const addSteps        = (d)         => { app.healthMetrics.addSteps(d); app.healthDisplay.updateSteps(); app.toast.show(`👟 Steps: ${app.healthMetrics.steps.toLocaleString()}`, 'info'); };
const adjustTemp      = (d)         => app.deviceManager.adjustTemp(d);
const setSpeakerVol   = (v)         => app.deviceManager.setSpeakerVol(v);
const syncDevices     = ()          => app.deviceManager.syncAll();
const toggleDevice    = (el, id, n) => app.deviceManager.toggle(id === 'new' ? id : id);
const sendChat        = ()          => app.chatManager.send(document.getElementById('chatInput').value);
const clearChat       = ()          => app.chatManager.clear();
const useSuggestion   = (el)        => app.chatManager.useSuggestion(el);
const chatKeydown     = (e)         => app.chatManager.handleKeydown(e);
const autoResize      = (el)        => { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px'; };
const showNotifications = ()        => app.toast.show('📬 3 new notifications — all caught up!', 'info');

// Profile functions
const toggleSetting    = (setting)  => {
  if (setting === 'notifications') {
    app.toast.show('🔔 Notification preferences updated', 'success');
  } else if (setting === 'darkMode') {
    document.body.classList.toggle('dark-mode');
    app.toast.show('🌙 Theme switched', 'info');
  }
};
const exportData       = ()         => {
  const data = {
    user: app.user.toJSON(),
    habits: app.habitManager.habits.map(h => h.toJSON()),
    goals: app.goalManager.goals.map(g => g.toJSON()),
    health: app.healthMetrics.toJSON(),
    exportedAt: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'lifeai-data-export.json';
  a.click();
  URL.revokeObjectURL(url);
  app.toast.show('📊 Data exported successfully', 'success');
};
const manageSubscription = ()      => app.toast.show('💳 Opening subscription management...', 'info');
const cancelSubscription = ()      => {
  if (confirm('Are you sure you want to cancel your Pro subscription? You\'ll lose access to premium features.')) {
    app.toast.show('😢 Subscription cancelled. You can resubscribe anytime.', 'warning');
  }
};

// toggleDeviceById — called from static HTML device toggles
// Maps simple string IDs to status element IDs
function toggleDeviceById(el, domId, name) {
  const on = el.checked;
  const statusMap = {
    lights:  on ? 'Warm white · 40% brightness' : 'Off',
    thermo:  on ? `${app.deviceManager._thermoTemp || 22}°C · Auto mode` : 'Off',
    speaker: on ? 'Idle · Volume 40%' : 'Off',
    sleep:   on ? 'Last night: 7.2h · Score 82' : 'Standby',
  };
  const statusEl = document.getElementById(domId + '-status');
  if (statusEl) statusEl.textContent = statusMap[domId] || (on ? 'On' : 'Off');
  app.toast.show(`${name} turned ${on ? 'ON 🟢' : 'OFF 🔴'}`, on ? 'success' : 'info');
}
