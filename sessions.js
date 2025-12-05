// ========== EINHEITEN-VERWALTUNG ==========

let currentWeekOffset = 0;

function changeWeek(offset) {
    currentWeekOffset += offset;
    loadTeacherSchedule();
}

function openAddSessionModal() {
    populateTeacherSelect('sessionTeacher');
    populateStudentCheckboxes('sessionStudentsList', 'selectedStudentsPreview');
    
    // Wiederholungsoptionen zurücksetzen
    document.getElementById('sessionRepeat').checked = false;
    document.getElementById('repeatOptions').style.display = 'none';
    document.getElementById('repeatPreview').innerHTML = '';
    document.getElementById('weekdaySelection').style.display = 'none';
    
    // Standard-Enddatum setzen (4 Wochen in der Zukunft)
    const defaultEndDate = new Date();
    defaultEndDate.setDate(defaultEndDate.getDate() + 28);
    document.getElementById('repeatEndDate').value = formatDateISO(defaultEndDate);
    
    document.getElementById('addSessionModal').classList.add('active');
}

function closeAddSessionModal() {
    document.getElementById('addSessionModal').classList.remove('active');
    document.getElementById('addSessionForm').reset();
    document.getElementById('selectedStudentsPreview').style.display = 'none';
    document.getElementById('repeatOptions').style.display = 'none';
    document.getElementById('repeatPreview').innerHTML = '';
}

// ========== WIEDERHOLUNGS-FUNKTIONEN ==========

function toggleRepeatOptions() {
    const isChecked = document.getElementById('sessionRepeat').checked;
    const options = document.getElementById('repeatOptions');
    options.style.display = isChecked ? 'block' : 'none';
    
    if (isChecked) {
        updateRepeatPreview();
    } else {
        document.getElementById('repeatPreview').innerHTML = '';
    }
}

function toggleWeekdaySelection() {
    const repeatType = document.getElementById('repeatType').value;
    const weekdaySelection = document.getElementById('weekdaySelection');
    weekdaySelection.style.display = repeatType === 'weekdays' ? 'block' : 'none';
    updateRepeatPreview();
}

function getSelectedWeekdays() {
    const checkboxes = document.querySelectorAll('#weekdaySelection input[type="checkbox"]:checked');
    return Array.from(checkboxes).map(cb => parseInt(cb.value));
}

function generateRepeatDates(startDate, endDate, repeatType, selectedWeekdays = []) {
    const dates = [];
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    
    if (start > end) return dates;
    
    const maxDates = 100;
    let current = new Date(start);
    
    while (current <= end && dates.length < maxDates) {
        const dayOfWeek = current.getDay();
        
        if (repeatType === 'daily') {
            dates.push(new Date(current));
        } else if (repeatType === 'weekly') {
            if (dayOfWeek === start.getDay()) {
                dates.push(new Date(current));
            }
        } else if (repeatType === 'weekdays') {
            if (selectedWeekdays.includes(dayOfWeek)) {
                dates.push(new Date(current));
            }
        }
        
        current.setDate(current.getDate() + 1);
    }
    
    return dates;
}

function updateRepeatPreview() {
    const preview = document.getElementById('repeatPreview');
    const startDate = document.getElementById('sessionDate').value;
    const endDate = document.getElementById('repeatEndDate').value;
    const repeatType = document.getElementById('repeatType').value;
    
    if (!startDate || !endDate) {
        preview.innerHTML = '<p style="color: var(--text-secondary);">Bitte Start- und Enddatum auswählen.</p>';
        return;
    }
    
    const selectedWeekdays = repeatType === 'weekdays' ? getSelectedWeekdays() : [];
    
    if (repeatType === 'weekdays' && selectedWeekdays.length === 0) {
        preview.innerHTML = '<p style="color: var(--text-secondary);">Bitte mindestens einen Wochentag auswählen.</p>';
        return;
    }
    
    const dates = generateRepeatDates(startDate, endDate, repeatType, selectedWeekdays);
    
    if (dates.length === 0) {
        preview.innerHTML = '<p style="color: var(--error);">Keine Termine im gewählten Zeitraum.</p>';
        return;
    }
    
    const dateStrings = dates.slice(0, 10).map(d => {
        const dayName = DAYS[d.getDay()];
        return `${dayName}, ${formatDateDisplay(d)}`;
    });
    
    let html = `
        <div class="repeat-preview-title">
            📅 Vorschau der Termine
        </div>
        <div class="repeat-preview-count">${dates.length} Einheiten</div>
        <div class="repeat-preview-dates">
            ${dateStrings.join('<br>')}
            ${dates.length > 10 ? `<br><em>... und ${dates.length - 10} weitere</em>` : ''}
        </div>
    `;
    
    if (dates.length > 50) {
        html += `
            <div class="repeat-preview-warning">
                ⚠️ Viele Einheiten! Es werden ${dates.length} Einheiten erstellt.
            </div>
        `;
    }
    
    preview.innerHTML = html;
}

function populateTeacherSelect(selectId) {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const teachers = users.sort((a, b) => a.name.localeCompare(b.name));
    
    const select = document.getElementById(selectId);
    select.innerHTML = '<option value="">Bitte wählen...</option>';
    
    teachers.forEach(t => {
        const option = document.createElement('option');
        option.value = t.id;
        const adminLabel = t.isSuperAdmin ? ' 👑' : (t.isAdmin ? ' ⭐' : '');
        option.textContent = t.name + adminLabel;
        select.appendChild(option);
    });
}

function populateStudentCheckboxes(containerId, previewId, selectedIds = []) {
    const students = JSON.parse(localStorage.getItem('students') || '[]');
    const activeStudents = students.filter(s => s.status === 'active');
    
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    if (activeStudents.length === 0) {
        container.innerHTML = '<p style="padding: 1rem; color: var(--text-secondary);">Keine aktiven Schüler vorhanden.</p>';
        return;
    }
    
    activeStudents.sort((a, b) => a.name.localeCompare(b.name));
    
    activeStudents.forEach(s => {
        const isChecked = selectedIds.includes(s.id);
        const item = document.createElement('div');
        item.className = 'student-checkbox-item';
        item.innerHTML = `
            <input type="checkbox" id="student_${s.id}" value="${s.id}" ${isChecked ? 'checked' : ''} 
                   onchange="updateSelectedStudentsPreview('${containerId}', '${previewId}')">
            <label for="student_${s.id}">${s.name}</label>
            ${s.grade ? `<span class="student-grade">Klasse ${s.grade}</span>` : ''}
        `;
        container.appendChild(item);
    });
    
    updateSelectedStudentsPreview(containerId, previewId);
}

function updateSelectedStudentsPreview(containerId, previewId) {
    const container = document.getElementById(containerId);
    const preview = document.getElementById(previewId);
    const checkboxes = container.querySelectorAll('input[type="checkbox"]:checked');
    
    if (checkboxes.length > 0) {
        preview.style.display = 'block';
        preview.innerHTML = `<span class="selected-count">${checkboxes.length}</span> Schüler ausgewählt`;
    } else {
        preview.style.display = 'none';
    }
}

function getSelectedStudentIds(containerId) {
    const container = document.getElementById(containerId);
    const checkboxes = container.querySelectorAll('input[type="checkbox"]:checked');
    return Array.from(checkboxes).map(cb => parseInt(cb.value));
}

// Add Session Form Handler
document.getElementById('addSessionForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const teacherId = parseInt(document.getElementById('sessionTeacher').value);
    const studentIds = getSelectedStudentIds('sessionStudentsList');
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const students = JSON.parse(localStorage.getItem('students') || '[]');
    
    const teacher = users.find(u => u.id === teacherId);
    
    if (!teacher) {
        alert('Bitte wählen Sie einen gültigen Lehrer!');
        return;
    }
    
    if (studentIds.length === 0) {
        alert('Bitte wählen Sie mindestens einen Schüler aus!');
        return;
    }
    
    const sessionStudents = studentIds.map(id => {
        const student = students.find(s => s.id === id);
        return {
            id: student.id,
            name: student.name,
            grade: student.grade || ''
        };
    });
    
    const startTime = document.getElementById('sessionStartTime').value;
    const endTime = document.getElementById('sessionEndTime').value;
    const notes = document.getElementById('sessionNotes').value;
    const isRepeat = document.getElementById('sessionRepeat').checked;
    
    let sessions = JSON.parse(localStorage.getItem('sessions') || '[]');
    let createdCount = 0;
    
    if (isRepeat) {
        const startDate = document.getElementById('sessionDate').value;
        const endDate = document.getElementById('repeatEndDate').value;
        const repeatType = document.getElementById('repeatType').value;
        const selectedWeekdays = repeatType === 'weekdays' ? getSelectedWeekdays() : [];
        
        if (repeatType === 'weekdays' && selectedWeekdays.length === 0) {
            alert('Bitte wählen Sie mindestens einen Wochentag aus!');
            return;
        }
        
        const dates = generateRepeatDates(startDate, endDate, repeatType, selectedWeekdays);
        
        if (dates.length === 0) {
            alert('Keine Termine im gewählten Zeitraum gefunden!');
            return;
        }
        
        if (dates.length > 20) {
            if (!confirm(`Es werden ${dates.length} Einheiten erstellt. Fortfahren?`)) {
                return;
            }
        }
        
        const seriesId = Date.now();
        
        dates.forEach((date, index) => {
            const session = {
                id: seriesId + index,
                seriesId: seriesId,
                teacherId: teacherId,
                teacherName: teacher.name,
                students: sessionStudents,
                date: formatDateISO(date),
                startTime: startTime,
                endTime: endTime,
                notes: notes,
                createdAt: new Date().toISOString()
            };
            sessions.push(session);
            createdCount++;
        });
    } else {
        const session = {
            id: Date.now(),
            teacherId: teacherId,
            teacherName: teacher.name,
            students: sessionStudents,
            date: document.getElementById('sessionDate').value,
            startTime: startTime,
            endTime: endTime,
            notes: notes,
            createdAt: new Date().toISOString()
        };
        sessions.push(session);
        createdCount = 1;
    }
    
    localStorage.setItem('sessions', JSON.stringify(sessions));
    
    closeAddSessionModal();
    loadSessionsList();
    updateAdminStats();
    
    if (createdCount > 1) {
        alert(`✅ ${createdCount} Einheiten erfolgreich erstellt!`);
    }
});

function openEditSessionModal(sessionId) {
    const sessions = JSON.parse(localStorage.getItem('sessions') || '[]');
    const session = sessions.find(s => s.id === sessionId);
    
    if (!session) return;
    
    populateTeacherSelect('editSessionTeacher');
    
    // Bestehende Schüler-IDs ermitteln (Kompatibilität)
    let selectedStudentIds = [];
    if (session.students && Array.isArray(session.students)) {
        selectedStudentIds = session.students.map(s => s.id);
    } else if (session.studentId) {
        selectedStudentIds = [session.studentId];
    }
    
    populateStudentCheckboxes('editSessionStudentsList', 'editSelectedStudentsPreview', selectedStudentIds);
    
    document.getElementById('editSessionId').value = session.id;
    document.getElementById('editSessionTeacher').value = session.teacherId;
    document.getElementById('editSessionDate').value = session.date;
    document.getElementById('editSessionStartTime').value = session.startTime;
    document.getElementById('editSessionEndTime').value = session.endTime;
    document.getElementById('editSessionNotes').value = session.notes || '';
    
    showSelectedDate('editSessionDate');
    
    document.getElementById('editSessionModal').classList.add('active');
}

function closeEditSessionModal() {
    document.getElementById('editSessionModal').classList.remove('active');
    document.getElementById('editSessionForm').reset();
    document.getElementById('editSelectedStudentsPreview').style.display = 'none';
}

// Edit Session Form Handler
document.getElementById('editSessionForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const sessionId = parseInt(document.getElementById('editSessionId').value);
    const teacherId = parseInt(document.getElementById('editSessionTeacher').value);
    const studentIds = getSelectedStudentIds('editSessionStudentsList');
    
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const students = JSON.parse(localStorage.getItem('students') || '[]');
    const teacher = users.find(u => u.id === teacherId);
    
    if (!teacher) {
        alert('Bitte wählen Sie einen gültigen Lehrer!');
        return;
    }
    
    if (studentIds.length === 0) {
        alert('Bitte wählen Sie mindestens einen Schüler aus!');
        return;
    }
    
    const sessionStudents = studentIds.map(id => {
        const student = students.find(s => s.id === id);
        return {
            id: student.id,
            name: student.name,
            grade: student.grade || ''
        };
    });
    
    let sessions = JSON.parse(localStorage.getItem('sessions') || '[]');
    const index = sessions.findIndex(s => s.id === sessionId);
    
    if (index !== -1) {
        sessions[index] = {
            ...sessions[index],
            teacherId: teacherId,
            teacherName: teacher.name,
            students: sessionStudents,
            date: document.getElementById('editSessionDate').value,
            startTime: document.getElementById('editSessionStartTime').value,
            endTime: document.getElementById('editSessionEndTime').value,
            notes: document.getElementById('editSessionNotes').value,
            updatedAt: new Date().toISOString()
        };
        
        localStorage.setItem('sessions', JSON.stringify(sessions));
        closeEditSessionModal();
        loadSessionsList();
    }
});

function deleteSession(sessionId) {
    if (!confirm('Möchten Sie diese Einheit wirklich löschen?')) {
        return;
    }
    
    let sessions = JSON.parse(localStorage.getItem('sessions') || '[]');
    const sessionToDelete = sessions.find(s => s.id === sessionId);
    
    if (sessionToDelete && sessionToDelete.seriesId) {
        const seriesSessions = sessions.filter(s => s.seriesId === sessionToDelete.seriesId);
        if (seriesSessions.length > 1) {
            const deleteAll = confirm(`Diese Einheit ist Teil einer Serie mit ${seriesSessions.length} Einheiten.\n\nMöchten Sie:\n- OK: Alle ${seriesSessions.length} Einheiten der Serie löschen\n- Abbrechen: Nur diese eine Einheit löschen`);
            
            if (deleteAll) {
                const seriesIds = seriesSessions.map(s => s.id);
                sessions = sessions.filter(s => s.seriesId !== sessionToDelete.seriesId);
                
                let attendance = JSON.parse(localStorage.getItem('attendance') || '[]');
                attendance = attendance.filter(a => !seriesIds.includes(a.sessionId));
                localStorage.setItem('attendance', JSON.stringify(attendance));
                
                localStorage.setItem('sessions', JSON.stringify(sessions));
                loadSessionsList();
                updateAdminStats();
                return;
            }
        }
    }
    
    sessions = sessions.filter(s => s.id !== sessionId);
    localStorage.setItem('sessions', JSON.stringify(sessions));
    
    let attendance = JSON.parse(localStorage.getItem('attendance') || '[]');
    attendance = attendance.filter(a => a.sessionId !== sessionId);
    localStorage.setItem('attendance', JSON.stringify(attendance));
    
    loadSessionsList();
    updateAdminStats();
}

function loadSessionsList() {
    let sessions = JSON.parse(localStorage.getItem('sessions') || '[]');
    const allSessions = [...sessions];
    const attendance = JSON.parse(localStorage.getItem('attendance') || '[]');
    
    const teacherFilter = document.getElementById('filterSessionTeacher')?.value.toLowerCase() || '';
    const studentFilter = document.getElementById('filterSessionStudent')?.value.toLowerCase() || '';
    
    sessions = sessions.filter(s => {
        const studentNames = getSessionStudentNames(s).join(' ').toLowerCase();
        return s.teacherName.toLowerCase().includes(teacherFilter) &&
               studentNames.includes(studentFilter);
    });
    
    sessions.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.startTime.localeCompare(b.startTime);
    });
    
    const list = document.getElementById('sessionsList');
    
    if (sessions.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⏰</div>
                <h3>Noch keine Einheiten</h3>
                <p>Erstellen Sie die erste Einheit!</p>
            </div>
        `;
        return;
    }
    
    list.innerHTML = sessions.map(s => {
        const date = new Date(s.date + 'T00:00:00');
        const dayName = DAYS[date.getDay()];
        const [year, month, day] = s.date.split('-');
        const dateStr = `${day}.${month}.${year}`;
        
        const studentNames = getSessionStudentNames(s);
        const studentIds = getSessionStudentIds(s);
        const sessionAttendance = attendance.filter(a => a.sessionId === s.id);
        const seriesInfo = getSeriesInfo(s, allSessions);
        
        return `
            <div class="session-item clickable" onclick="openAttendanceModal(${s.id})">
                <div class="session-info">
                    <div class="session-title">
                        <span class="day-badge">${dayName}, ${dateStr}</span>
                        ${s.startTime} - ${s.endTime}
                        ${seriesInfo ? `<span class="series-badge">🔄 ${seriesInfo.index}/${seriesInfo.count}</span>` : ''}
                    </div>
                    <div class="session-details">
                        <span class="session-detail-item">👨‍🏫 ${s.teacherName}</span>
                        <span class="session-detail-item">👨‍🎓 ${studentNames.length} Schüler</span>
                    </div>
                    <div class="session-students-list">
                        ${studentNames.map((name, idx) => {
                            const studentId = studentIds[idx];
                            const att = sessionAttendance.find(a => a.studentId === studentId);
                            const badge = att ? getAttendanceBadgeHTML(att.status) : '<span class="attendance-badge none">⚪</span>';
                            return `<span class="session-student-chip">${badge} ${name}</span>`;
                        }).join('')}
                    </div>
                    <div class="click-hint">👆 Klicken um Anwesenheit einzutragen</div>
                    ${s.notes ? `<div class="session-details" style="margin-top: 0.5rem;"><span class="session-detail-item">💬 ${s.notes}</span></div>` : ''}
                </div>
                <div class="session-actions" onclick="event.stopPropagation()">
                    <button class="btn btn-warning btn-small" onclick="openEditSessionModal(${s.id})">
                        ✏️ Bearbeiten
                    </button>
                    <button class="btn btn-danger btn-small" onclick="deleteSession(${s.id})">
                        🗑️ Löschen
                    </button>
                </div>
            </div>
        `;
    }).join('');
}
