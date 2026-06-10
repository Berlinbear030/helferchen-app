package com.helferchen.app.viewmodel

import com.helferchen.app.api.ApiClient
import com.helferchen.app.model.*
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*

class AppViewModel(private val api: ApiClient = ApiClient()) {
    companion object { const val CURRENT_VERSION_CODE = 2 }
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    private val _user = MutableStateFlow<User?>(null)
    val user: StateFlow<User?> = _user

    private val _loginError = MutableStateFlow<String?>(null)
    val loginError: StateFlow<String?> = _loginError

    private val _assignments = MutableStateFlow<List<Assignment>>(emptyList())
    val assignments: StateFlow<List<Assignment>> = _assignments

    private val _selectedAssignment = MutableStateFlow<Assignment?>(null)
    val selectedAssignment: StateFlow<Assignment?> = _selectedAssignment

    private val _activeTimelog = MutableStateFlow<Timelog?>(null)
    val activeTimelog: StateFlow<Timelog?> = _activeTimelog

    private val _currentReport = MutableStateFlow<Report?>(null)
    val currentReport: StateFlow<Report?> = _currentReport

    // Elapsed seconds updated locally every second while timer runs
    private val _elapsedSeconds = MutableStateFlow(0L)
    val elapsedSeconds: StateFlow<Long> = _elapsedSeconds
    private var timerJob: Job? = null

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error

    private val _updateInfo = MutableStateFlow<AppVersionInfo?>(null)
    val updateInfo: StateFlow<AppVersionInfo?> = _updateInfo

    fun checkForUpdate() {
        scope.launch {
            val info = api.checkUpdate()
            if (info != null && info.versionCode > CURRENT_VERSION_CODE) {
                _updateInfo.value = info
            }
        }
    }

    fun dismissUpdate() { _updateInfo.value = null }

    fun login(username: String, password: String, onSuccess: () -> Unit) {
        scope.launch {
            _isLoading.value = true
            _loginError.value = null
            try {
                val resp = api.login(username, password)
                _user.value = resp.user
                onSuccess()
            } catch (e: Exception) {
                _loginError.value = "Login fehlgeschlagen. Bitte prüfen Sie Ihre Zugangsdaten."
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun logout() {
        timerJob?.cancel()
        timerJob = null
        _user.value = null
        api.token = null
        _assignments.value = emptyList()
        _selectedAssignment.value = null
        _activeTimelog.value = null
        _currentReport.value = null
        _elapsedSeconds.value = 0L
        _loginError.value = null
        _error.value = null
    }

    fun fetchAssignments() {
        scope.launch {
            _isLoading.value = true
            _error.value = null
            try {
                _assignments.value = api.getMyAssignments()
            } catch (e: Exception) {
                _error.value = "Aufträge konnten nicht geladen werden."
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun selectAssignment(assignment: Assignment) {
        _selectedAssignment.value = assignment
        _activeTimelog.value = null
        _currentReport.value = null
        _elapsedSeconds.value = 0L
    }

    fun startTimer(onSuccess: () -> Unit) {
        val assignment = _selectedAssignment.value ?: return
        scope.launch {
            _isLoading.value = true
            _error.value = null
            try {
                val timelog = api.startTimer(assignment.id)
                _activeTimelog.value = timelog
                _elapsedSeconds.value = 0L
                beginLocalTimer()
                onSuccess()
            } catch (e: Exception) {
                _error.value = "Timer konnte nicht gestartet werden."
            } finally {
                _isLoading.value = false
            }
        }
    }

    private fun beginLocalTimer() {
        timerJob?.cancel()
        timerJob = scope.launch {
            while (true) {
                delay(1_000)
                _elapsedSeconds.value += 1
            }
        }
    }

    fun stopTimer(onSuccess: () -> Unit) {
        val timelog = _activeTimelog.value ?: return
        scope.launch {
            _isLoading.value = true
            _error.value = null
            try {
                timerJob?.cancel()
                timerJob = null
                val stopped = api.stopTimer(timelog.id)
                _activeTimelog.value = stopped
                onSuccess()
            } catch (e: Exception) {
                _error.value = "Timer konnte nicht gestoppt werden."
                beginLocalTimer() // resume if stop failed
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun submitReport(notes: String, onSuccess: () -> Unit) {
        val assignment = _selectedAssignment.value ?: return
        val timelog = _activeTimelog.value ?: return
        scope.launch {
            _isLoading.value = true
            _error.value = null
            try {
                val report = api.createReport(assignment.id, timelog.id, notes)
                _currentReport.value = report
                onSuccess()
            } catch (e: Exception) {
                _error.value = "Bericht konnte nicht erstellt werden."
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun submitSignature(imageData: String, signerName: String, onSuccess: () -> Unit) {
        val report = _currentReport.value ?: return
        scope.launch {
            _isLoading.value = true
            _error.value = null
            try {
                api.submitSignature(report.id, imageData, signerName)
                onSuccess()
            } catch (e: Exception) {
                _error.value = "Unterschrift konnte nicht gespeichert werden."
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun sendPdfEmail(email: String, onSuccess: () -> Unit) {
        val report = _currentReport.value ?: return
        scope.launch {
            _isLoading.value = true
            _error.value = null
            try {
                api.sendPdfEmail(report.id, email)
                onSuccess()
            } catch (e: Exception) {
                _error.value = "E-Mail konnte nicht gesendet werden."
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun getPdfUrl(): String? = _currentReport.value?.let { api.getPdfUrl(it.id) }

    fun clearError() { _error.value = null }
}
