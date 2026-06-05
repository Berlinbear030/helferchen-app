package com.helferchen.app

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.helferchen.app.model.Assignment
import com.helferchen.app.viewmodel.AppViewModel
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

private val PrimaryTeal = Color(0xFF00454A)
private val AccentGold = Color(0xFFFFB300)
private val GreenSuccess = Color(0xFF10B981)
private val RedError = Color(0xFFEF4444)

enum class Screen {
    Login, Dashboard, AppointmentList, Timer, Report, Signature, PdfShare
}

@Composable
fun App() {
    var screen by remember { mutableStateOf(Screen.Login) }
    val vm = remember { AppViewModel() }

    MaterialTheme(
        colors = lightColors(primary = PrimaryTeal, secondary = AccentGold)
    ) {
        Surface(modifier = Modifier.fillMaxSize(), color = Color(0xFFF9FAFB)) {
            when (screen) {
                Screen.Login -> LoginScreen(vm) { screen = Screen.Dashboard }
                Screen.Dashboard -> DashboardScreen(vm,
                    onOpenAppointments = { screen = Screen.AppointmentList },
                    onLogout = {
                        vm.logout()
                        screen = Screen.Login
                    }
                )
                Screen.AppointmentList -> AppointmentListScreen(vm,
                    onAssignmentSelected = { screen = Screen.Timer },
                    onLogout = {
                        vm.logout()
                        screen = Screen.Login
                    },
                    onBack = { screen = Screen.Dashboard }
                )
                Screen.Timer -> TimerScreen(vm,
                    onBack = { screen = Screen.AppointmentList },
                    onTimerStopped = { screen = Screen.Report }
                )
                Screen.Report -> ReportScreen(vm,
                    onBack = { screen = Screen.Timer },
                    onReportSubmitted = { screen = Screen.Signature }
                )
                Screen.Signature -> SignatureScreen(vm,
                    onBack = { screen = Screen.Report },
                    onSigned = { screen = Screen.PdfShare }
                )
                Screen.PdfShare -> PdfShareScreen(vm,
                    onDone = {
                        vm.fetchAssignments()
                        screen = Screen.Dashboard
                    }
                )
            }
        }
    }
}

// ─── Login Screen ─────────────────────────────────────────────────────────────

@Composable
fun LoginScreen(vm: AppViewModel, onSuccess: () -> Unit) {
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var showPassword by remember { mutableStateOf(false) }
    val isLoading by vm.isLoading.collectAsState()
    val loginError by vm.loginError.collectAsState()

    Column(
        modifier = Modifier.fillMaxSize().padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        // Sketch-style logo placeholder: house icon + brand name
        Box(
            modifier = Modifier
                .size(100.dp)
                .background(Color(0xFFE8F5EF), RoundedCornerShape(20.dp))
                .border(2.dp, PrimaryTeal, RoundedCornerShape(20.dp)),
            contentAlignment = Alignment.Center
        ) {
            Text("🏠", fontSize = 44.sp)
        }
        Spacer(Modifier.height(16.dp))
        Text(
            "HELFERCHEN",
            fontSize = 28.sp,
            fontWeight = FontWeight.Bold,
            color = PrimaryTeal,
            letterSpacing = 3.sp
        )
        Text("Nachbarschaftshilfe", fontSize = 14.sp, color = Color.Gray)
        Spacer(Modifier.height(48.dp))

        OutlinedTextField(
            value = username,
            onValueChange = { username = it },
            label = { Text("Benutzername") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(Modifier.height(16.dp))
        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("Passwort") },
            singleLine = true,
            visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            trailingIcon = {
                TextButton(onClick = { showPassword = !showPassword }) {
                    Text(if (showPassword) "Verbergen" else "Anzeigen", fontSize = 12.sp)
                }
            },
            modifier = Modifier.fillMaxWidth()
        )

        loginError?.let { err ->
            Spacer(Modifier.height(12.dp))
            Text(err, color = MaterialTheme.colors.error, fontSize = 14.sp, textAlign = TextAlign.Center)
        }

        Spacer(Modifier.height(32.dp))
        Button(
            onClick = { vm.login(username, password, onSuccess) },
            enabled = username.isNotBlank() && password.isNotBlank() && !isLoading,
            modifier = Modifier.fillMaxWidth().height(52.dp),
            shape = RoundedCornerShape(8.dp)
        ) {
            if (isLoading) CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.size(24.dp))
            else Text("Anmelden", fontSize = 16.sp)
        }
    }
}

// ─── Dashboard Screen ─────────────────────────────────────────────────────────

@Composable
fun DashboardScreen(vm: AppViewModel, onOpenAppointments: () -> Unit, onLogout: () -> Unit) {
    val user by vm.user.collectAsState()
    val assignments by vm.assignments.collectAsState()
    val isLoading by vm.isLoading.collectAsState()

    LaunchedEffect(Unit) { vm.fetchAssignments() }

    val today = LocalDate.now().toString()
    val todayAssignments = assignments.filter { it.scheduledAt.startsWith(today) }
    val openAssignments = assignments.filter { it.status == "pending" || it.status == "in_progress" }
    val completedToday = todayAssignments.filter { it.status == "completed" }

    // Revenue calculation: 20€ first 15min, 15€ each additional 15min → approx 60€/h average
    val dailyRevenue = completedToday.size * 35.0
    val monthlyRevenue = assignments.filter { it.status == "completed" }.size * 35.0

    Column(modifier = Modifier.fillMaxSize()) {
        TopAppBar(
            title = { Text("Dashboard") },
            backgroundColor = PrimaryTeal,
            contentColor = Color.White,
            actions = {
                TextButton(onClick = onLogout) { Text("Abmelden", color = Color.White) }
            }
        )

        Column(
            modifier = Modifier.fillMaxSize().padding(16.dp).verticalScroll(rememberScrollState())
        ) {
            user?.let { u ->
                Text("Hallo, ${u.fullName}!", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = PrimaryTeal)
                Text(
                    LocalDate.now().format(DateTimeFormatter.ofPattern("EEEE, d. MMMM yyyy", Locale("de"))),
                    fontSize = 14.sp, color = Color.Gray
                )
                Spacer(Modifier.height(20.dp))
            }

            // Stats row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                StatCard("Heute", "${todayAssignments.size} Termine", AccentGold, Modifier.weight(1f))
                StatCard("Tageseinnahmen", "%.0f €".format(dailyRevenue), GreenSuccess, Modifier.weight(1f))
            }
            Spacer(Modifier.height(12.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                StatCard("Monatseinnahmen", "%.0f €".format(monthlyRevenue), PrimaryTeal, Modifier.weight(1f))
                StatCard("Offene Aufträge", "${openAssignments.size}", Color(0xFFEF4444), Modifier.weight(1f))
            }

            Spacer(Modifier.height(24.dp))

            // Heutige Termine
            Text("Heutige Termine", fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(8.dp))

            if (isLoading) {
                Box(modifier = Modifier.fillMaxWidth().padding(16.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = PrimaryTeal)
                }
            } else if (todayAssignments.isEmpty()) {
                Card(modifier = Modifier.fillMaxWidth(), elevation = 2.dp, shape = RoundedCornerShape(8.dp)) {
                    Box(modifier = Modifier.padding(24.dp), contentAlignment = Alignment.Center) {
                        Text("Keine Termine für heute.", color = Color.Gray, textAlign = TextAlign.Center)
                    }
                }
            } else {
                todayAssignments.take(3).forEach { assignment ->
                    AssignmentCard(assignment) {}
                    Spacer(Modifier.height(8.dp))
                }
            }

            Spacer(Modifier.height(16.dp))

            // Offene Aufträge section
            if (openAssignments.isNotEmpty()) {
                Text("Offene Aufträge", fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(8.dp))
                openAssignments.take(5).forEach { assignment ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        elevation = 2.dp,
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(assignment.title, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                                assignment.customer?.let { c ->
                                    Text(c.fullName, fontSize = 13.sp, color = Color.Gray)
                                }
                            }
                            StatusChip(assignment.status)
                        }
                    }
                    Spacer(Modifier.height(6.dp))
                }
            }

            Spacer(Modifier.height(20.dp))

            Button(
                onClick = onOpenAppointments,
                modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = RoundedCornerShape(8.dp),
                colors = ButtonDefaults.buttonColors(backgroundColor = PrimaryTeal, contentColor = Color.White)
            ) {
                Text("Alle Aufträge anzeigen", fontSize = 16.sp)
            }
        }
    }
}

@Composable
fun StatCard(label: String, value: String, color: Color, modifier: Modifier = Modifier) {
    Card(modifier = modifier, elevation = 3.dp, shape = RoundedCornerShape(10.dp)) {
        Column(
            modifier = Modifier.padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(value, fontSize = 22.sp, fontWeight = FontWeight.Bold, color = color, textAlign = TextAlign.Center)
            Spacer(Modifier.height(4.dp))
            Text(label, fontSize = 12.sp, color = Color.Gray, textAlign = TextAlign.Center)
        }
    }
}

// ─── Appointment List Screen ───────────────────────────────────────────────────

@Composable
fun AppointmentListScreen(vm: AppViewModel, onAssignmentSelected: () -> Unit, onLogout: () -> Unit, onBack: () -> Unit = {}) {
    val user by vm.user.collectAsState()
    val assignments by vm.assignments.collectAsState()
    val isLoading by vm.isLoading.collectAsState()
    val error by vm.error.collectAsState()

    LaunchedEffect(Unit) { vm.fetchAssignments() }

    Column(modifier = Modifier.fillMaxSize()) {
        TopAppBar(
            title = { Text("Meine Aufträge") },
            backgroundColor = PrimaryTeal,
            contentColor = Color.White,
            navigationIcon = {
                TextButton(onClick = onBack) { Text("< Zurück", color = Color.White) }
            },
            actions = {
                TextButton(onClick = onLogout) { Text("Abmelden", color = Color.White) }
            }
        )

        Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
            user?.let { u ->
                Text("Hallo, ${u.fullName}!", fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(16.dp))
            }

            error?.let { err ->
                Card(backgroundColor = Color(0xFFFFEBEE), modifier = Modifier.fillMaxWidth()) {
                    Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text(err, color = RedError, modifier = Modifier.weight(1f))
                        TextButton(onClick = { vm.clearError() }) { Text("OK") }
                    }
                }
                Spacer(Modifier.height(8.dp))
            }

            if (isLoading) {
                Box(modifier = Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = PrimaryTeal)
                }
            } else if (assignments.isEmpty()) {
                Box(modifier = Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                    Text("Keine Aufträge für heute.", color = Color.Gray, textAlign = TextAlign.Center)
                }
            } else {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(assignments) { assignment ->
                        AssignmentCard(assignment) {
                            vm.selectAssignment(assignment)
                            onAssignmentSelected()
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun AssignmentCard(assignment: Assignment, onClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        elevation = 3.dp,
        shape = RoundedCornerShape(8.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(assignment.title, fontSize = 18.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                StatusChip(assignment.status)
            }
            assignment.customer?.let { c ->
                Spacer(Modifier.height(4.dp))
                Text(c.fullName, fontSize = 14.sp, color = Color.DarkGray)
                Text(c.address, fontSize = 13.sp, color = Color.Gray)
            }
            if (assignment.description.isNotBlank()) {
                Spacer(Modifier.height(4.dp))
                Text(assignment.description, fontSize = 13.sp, color = Color.Gray, maxLines = 2)
            }
        }
    }
}

@Composable
fun StatusChip(status: String) {
    val (bg, text) = when (status) {
        "pending" -> Color(0xFFFFF9C4) to Color(0xFFF57F17)
        "in_progress" -> Color(0xFFE3F2FD) to Color(0xFF1565C0)
        "completed" -> Color(0xFFE8F5E9) to Color(0xFF2E7D32)
        else -> Color(0xFFF3E5F5) to Color(0xFF6A1B9A)
    }
    val label = when (status) {
        "pending" -> "Offen"
        "in_progress" -> "Läuft"
        "completed" -> "Erledigt"
        else -> status
    }
    Surface(color = bg, shape = RoundedCornerShape(12.dp)) {
        Text(label, color = text, fontSize = 12.sp, modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp))
    }
}

// ─── Timer Screen ──────────────────────────────────────────────────────────────

@Composable
fun TimerScreen(vm: AppViewModel, onBack: () -> Unit, onTimerStopped: () -> Unit) {
    val assignment by vm.selectedAssignment.collectAsState()
    val timelog by vm.activeTimelog.collectAsState()
    val elapsedSeconds by vm.elapsedSeconds.collectAsState()
    val isLoading by vm.isLoading.collectAsState()
    val error by vm.error.collectAsState()

    val isRunning = timelog != null && timelog?.endTime == null

    Column(modifier = Modifier.fillMaxSize()) {
        TopAppBar(
            title = { Text("Zeiterfassung") },
            backgroundColor = PrimaryTeal,
            contentColor = Color.White,
            navigationIcon = {
                TextButton(onClick = onBack, enabled = !isRunning) {
                    Text("< Zurück", color = if (isRunning) Color.Gray else Color.White)
                }
            }
        )

        Column(
            modifier = Modifier.fillMaxSize().padding(16.dp).verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            assignment?.let { a ->
                Text(a.title, fontSize = 24.sp, fontWeight = FontWeight.Bold, color = PrimaryTeal)
                a.customer?.let { c ->
                    Spacer(Modifier.height(4.dp))
                    Text(c.fullName, fontSize = 16.sp)
                    Text(c.address, fontSize = 14.sp, color = Color.Gray)
                    c.phoneNumber?.let { p -> Text(p, fontSize = 14.sp, color = Color.Gray) }
                }
                if (a.description.isNotBlank()) {
                    Spacer(Modifier.height(8.dp))
                    Text(a.description, fontSize = 14.sp, color = Color.DarkGray)
                }
            }

            Spacer(Modifier.height(32.dp))

            Card(
                modifier = Modifier.fillMaxWidth(),
                elevation = 4.dp,
                shape = RoundedCornerShape(12.dp),
                backgroundColor = if (isRunning) Color(0xFFE8F5E9) else Color.White
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text("Arbeitszeit", fontSize = 16.sp, color = Color.Gray)
                    Spacer(Modifier.height(8.dp))
                    Text(
                        formatDuration(elapsedSeconds),
                        fontSize = 56.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (isRunning) GreenSuccess else PrimaryTeal
                    )

                    val blocks = ((elapsedSeconds / 60) / 15).coerceAtLeast(if (elapsedSeconds > 0) 1 else 0)
                    val minutes = elapsedSeconds / 60
                    if (minutes > 0) {
                        Text("$minutes min → $blocks × 15-min-Block", fontSize = 14.sp, color = Color.Gray)
                    }

                    Spacer(Modifier.height(24.dp))

                    if (!isRunning) {
                        Button(
                            onClick = { vm.startTimer { /* timer started, UI updates via state */ } },
                            enabled = !isLoading,
                            modifier = Modifier.fillMaxWidth().height(56.dp),
                            shape = RoundedCornerShape(8.dp),
                            colors = ButtonDefaults.buttonColors(backgroundColor = GreenSuccess, contentColor = Color.White)
                        ) {
                            if (isLoading) CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.size(24.dp))
                            else Text("Starten", fontSize = 18.sp, fontWeight = FontWeight.Bold)
                        }
                    } else {
                        Button(
                            onClick = { vm.stopTimer(onTimerStopped) },
                            enabled = !isLoading,
                            modifier = Modifier.fillMaxWidth().height(56.dp),
                            shape = RoundedCornerShape(8.dp),
                            colors = ButtonDefaults.buttonColors(backgroundColor = RedError, contentColor = Color.White)
                        ) {
                            if (isLoading) CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.size(24.dp))
                            else Text("Stoppen", fontSize = 18.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            error?.let { err ->
                Spacer(Modifier.height(12.dp))
                Text(err, color = RedError, textAlign = TextAlign.Center)
                TextButton(onClick = { vm.clearError() }) { Text("OK") }
            }
        }
    }
}

fun formatDuration(totalSeconds: Long): String {
    val h = totalSeconds / 3600
    val m = (totalSeconds % 3600) / 60
    val s = totalSeconds % 60
    return "${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}"
}

// ─── Report Screen ─────────────────────────────────────────────────────────────

@Composable
fun ReportScreen(vm: AppViewModel, onBack: () -> Unit, onReportSubmitted: () -> Unit) {
    val assignment by vm.selectedAssignment.collectAsState()
    val timelog by vm.activeTimelog.collectAsState()
    val elapsedSeconds by vm.elapsedSeconds.collectAsState()
    val isLoading by vm.isLoading.collectAsState()
    val error by vm.error.collectAsState()
    var notes by remember { mutableStateOf("") }

    Column(modifier = Modifier.fillMaxSize()) {
        TopAppBar(
            title = { Text("Arbeitsbericht") },
            backgroundColor = PrimaryTeal,
            contentColor = Color.White,
            navigationIcon = {
                TextButton(onClick = onBack) { Text("< Zurück", color = Color.White) }
            }
        )

        Column(
            modifier = Modifier.fillMaxSize().padding(16.dp).verticalScroll(rememberScrollState())
        ) {
            // Summary card
            Card(modifier = Modifier.fillMaxWidth(), elevation = 2.dp, shape = RoundedCornerShape(8.dp)) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("Zusammenfassung", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = PrimaryTeal)
                    Spacer(Modifier.height(8.dp))
                    assignment?.let { a ->
                        SummaryRow("Auftrag", a.title)
                        a.customer?.let { c ->
                            SummaryRow("Kunde", c.fullName)
                            SummaryRow("Adresse", c.address)
                        }
                    }
                    timelog?.let { t ->
                        SummaryRow("Beginn", formatTimestamp(t.startTime))
                        t.endTime?.let { e -> SummaryRow("Ende", formatTimestamp(e)) }
                    }
                    val minutes = elapsedSeconds / 60
                    if (minutes > 0) SummaryRow("Dauer", "$minutes Minuten")
                }
            }

            Spacer(Modifier.height(24.dp))

            Text("Tätigkeitsbericht", fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                value = notes,
                onValueChange = { notes = it },
                placeholder = { Text("Was wurde erledigt? Besonderheiten?") },
                modifier = Modifier.fillMaxWidth().height(160.dp),
                maxLines = 8
            )

            error?.let { err ->
                Spacer(Modifier.height(12.dp))
                Text(err, color = RedError, textAlign = TextAlign.Center)
                TextButton(onClick = { vm.clearError() }) { Text("OK") }
            }

            Spacer(Modifier.height(24.dp))
            Button(
                onClick = { vm.submitReport(notes, onReportSubmitted) },
                enabled = !isLoading,
                modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = RoundedCornerShape(8.dp)
            ) {
                if (isLoading) CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.size(24.dp))
                else Text("Weiter zur Unterschrift", fontSize = 16.sp)
            }
        }
    }
}

@Composable
fun SummaryRow(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp)) {
        Text("$label: ", fontSize = 14.sp, color = Color.Gray, modifier = Modifier.width(80.dp))
        Text(value, fontSize = 14.sp, modifier = Modifier.weight(1f))
    }
}

fun formatTimestamp(iso: String): String {
    // Simple extraction: "2024-06-01T14:30:00.000Z" → "01.06.2024 14:30"
    return try {
        val date = iso.substringBefore('T')
        val time = iso.substringAfter('T').take(5)
        val (year, month, day) = date.split('-')
        "$day.$month.$year $time"
    } catch (e: Exception) {
        iso
    }
}

// ─── Signature Screen ──────────────────────────────────────────────────────────

@Composable
fun SignatureScreen(vm: AppViewModel, onBack: () -> Unit, onSigned: () -> Unit) {
    val isLoading by vm.isLoading.collectAsState()
    val error by vm.error.collectAsState()
    var signerName by remember { mutableStateOf("") }
    val paths = remember { mutableStateListOf<List<Offset>>() }
    val currentPath = remember { mutableStateListOf<Offset>() }
    var canvasSize by remember { mutableStateOf(Pair(0f, 0f)) }

    Column(modifier = Modifier.fillMaxSize()) {
        TopAppBar(
            title = { Text("Unterschrift") },
            backgroundColor = PrimaryTeal,
            contentColor = Color.White,
            navigationIcon = {
                TextButton(onClick = onBack) { Text("< Zurück", color = Color.White) }
            }
        )

        Column(
            modifier = Modifier.fillMaxSize().padding(16.dp).verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                "Bitte unterschreiben Sie mit dem Finger.",
                fontSize = 16.sp,
                color = Color.DarkGray,
                textAlign = TextAlign.Center
            )
            Spacer(Modifier.height(16.dp))

            // Signature canvas
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(220.dp)
                    .background(Color.White)
                    .border(1.5.dp, Color(0xFFBDBDBD), RoundedCornerShape(8.dp))
            ) {
                Canvas(
                    modifier = Modifier
                        .fillMaxSize()
                        .pointerInput(Unit) {
                            detectDragGestures(
                                onDragStart = { offset ->
                                    canvasSize = Pair(size.width.toFloat(), size.height.toFloat())
                                    currentPath.clear()
                                    currentPath.add(offset)
                                },
                                onDrag = { change, _ ->
                                    currentPath.add(change.position)
                                },
                                onDragEnd = {
                                    if (currentPath.size >= 2) {
                                        paths.add(currentPath.toList())
                                    }
                                    currentPath.clear()
                                },
                                onDragCancel = { currentPath.clear() }
                            )
                        }
                ) {
                    val strokeStyle = Stroke(width = 4f, cap = StrokeCap.Round, join = StrokeJoin.Round)
                    for (pathPoints in paths) {
                        if (pathPoints.size < 2) continue
                        val p = Path().apply {
                            moveTo(pathPoints[0].x, pathPoints[0].y)
                            for (i in 1 until pathPoints.size) lineTo(pathPoints[i].x, pathPoints[i].y)
                        }
                        drawPath(p, Color.Black, style = strokeStyle)
                    }
                    if (currentPath.size >= 2) {
                        val p = Path().apply {
                            moveTo(currentPath[0].x, currentPath[0].y)
                            for (i in 1 until currentPath.size) lineTo(currentPath[i].x, currentPath[i].y)
                        }
                        drawPath(p, Color.Black, style = strokeStyle)
                    }
                }

                // Placeholder hint when empty
                if (paths.isEmpty() && currentPath.isEmpty()) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text("Unterschrift hier", color = Color(0xFFBDBDBD), fontSize = 18.sp)
                    }
                }
            }

            Spacer(Modifier.height(8.dp))
            TextButton(onClick = { paths.clear(); currentPath.clear() }) {
                Text("Löschen", color = RedError)
            }

            Spacer(Modifier.height(16.dp))
            OutlinedTextField(
                value = signerName,
                onValueChange = { signerName = it },
                label = { Text("Name des Unterzeichners") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )

            error?.let { err ->
                Spacer(Modifier.height(12.dp))
                Text(err, color = RedError, textAlign = TextAlign.Center)
                TextButton(onClick = { vm.clearError() }) { Text("OK") }
            }

            Spacer(Modifier.height(24.dp))
            Button(
                onClick = {
                    val imageData = pathsToSvgDataUri(paths.toList(), canvasSize.first, canvasSize.second)
                    vm.submitSignature(imageData, signerName, onSigned)
                },
                enabled = paths.isNotEmpty() && signerName.isNotBlank() && !isLoading,
                modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = RoundedCornerShape(8.dp)
            ) {
                if (isLoading) CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.size(24.dp))
                else Text("Unterschrift bestätigen", fontSize = 16.sp)
            }
        }
    }
}

/** Encode signature paths as an SVG base64 data URI. */
fun pathsToSvgDataUri(paths: List<List<Offset>>, width: Float, height: Float): String {
    val w = if (width > 0f) width.toInt() else 400
    val h = if (height > 0f) height.toInt() else 220
    val pathElements = paths.mapNotNull { pts ->
        if (pts.size < 2) return@mapNotNull null
        val d = buildString {
            append("M ${pts[0].x.toInt()} ${pts[0].y.toInt()}")
            for (i in 1 until pts.size) append(" L ${pts[i].x.toInt()} ${pts[i].y.toInt()}")
        }
        """<path d="$d" stroke="black" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>"""
    }.joinToString("\n")
    val svg = """<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="$w" height="$h"><rect width="100%" height="100%" fill="white"/>$pathElements</svg>"""
    return "data:image/svg+xml;base64,${base64Encode(svg.encodeToByteArray())}"
}

private val B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

fun base64Encode(bytes: ByteArray): String {
    val sb = StringBuilder()
    var i = 0
    while (i < bytes.size) {
        val b0 = bytes[i].toInt() and 0xFF
        val b1 = if (i + 1 < bytes.size) bytes[i + 1].toInt() and 0xFF else 0
        val b2 = if (i + 2 < bytes.size) bytes[i + 2].toInt() and 0xFF else 0
        sb.append(B64[b0 shr 2])
        sb.append(B64[((b0 and 3) shl 4) or (b1 shr 4)])
        sb.append(if (i + 1 < bytes.size) B64[((b1 and 15) shl 2) or (b2 shr 6)] else '=')
        sb.append(if (i + 2 < bytes.size) B64[b2 and 63] else '=')
        i += 3
    }
    return sb.toString()
}

// ─── PDF / Share Screen ────────────────────────────────────────────────────────

@Composable
fun PdfShareScreen(vm: AppViewModel, onDone: () -> Unit) {
    val isLoading by vm.isLoading.collectAsState()
    val error by vm.error.collectAsState()
    var emailInput by remember { mutableStateOf("") }
    var emailSent by remember { mutableStateOf(false) }
    val pdfUrl = remember { vm.getPdfUrl() }

    Column(modifier = Modifier.fillMaxSize()) {
        TopAppBar(
            title = { Text("Bericht & PDF") },
            backgroundColor = PrimaryTeal,
            contentColor = Color.White
        )

        Column(
            modifier = Modifier.fillMaxSize().padding(24.dp).verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Success indicator
            Surface(
                shape = RoundedCornerShape(50),
                color = Color(0xFFE8F5E9),
                modifier = Modifier.size(80.dp)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Text("✓", fontSize = 40.sp, color = GreenSuccess)
                }
            }
            Spacer(Modifier.height(16.dp))
            Text("Auftrag abgeschlossen!", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = PrimaryTeal)
            Text("Bericht & Unterschrift gespeichert.", fontSize = 14.sp, color = Color.Gray, textAlign = TextAlign.Center)

            Spacer(Modifier.height(32.dp))
            Divider()
            Spacer(Modifier.height(24.dp))

            // Email section
            Text("PDF per E-Mail senden", fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(
                value = emailInput,
                onValueChange = { emailInput = it },
                label = { Text("E-Mail-Adresse") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(Modifier.height(12.dp))
            Button(
                onClick = {
                    vm.sendPdfEmail(emailInput) { emailSent = true }
                },
                enabled = emailInput.isNotBlank() && !isLoading && !emailSent,
                modifier = Modifier.fillMaxWidth().height(48.dp),
                shape = RoundedCornerShape(8.dp),
                colors = ButtonDefaults.buttonColors(backgroundColor = AccentGold, contentColor = Color.White)
            ) {
                if (isLoading) CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.size(22.dp))
                else Text(if (emailSent) "E-Mail gesendet ✓" else "PDF per E-Mail senden", fontSize = 15.sp)
            }

            // PDF URL for manual download
            pdfUrl?.let { url ->
                Spacer(Modifier.height(24.dp))
                Divider()
                Spacer(Modifier.height(16.dp))
                Text("PDF-Link (für Browser):", fontSize = 14.sp, color = Color.Gray)
                Spacer(Modifier.height(4.dp))
                Text(url, fontSize = 12.sp, color = PrimaryTeal, textAlign = TextAlign.Center)
            }

            error?.let { err ->
                Spacer(Modifier.height(12.dp))
                Text(err, color = RedError, textAlign = TextAlign.Center)
                TextButton(onClick = { vm.clearError() }) { Text("OK") }
            }

            Spacer(Modifier.height(32.dp))
            Button(
                onClick = onDone,
                modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = RoundedCornerShape(8.dp)
            ) {
                Text("Zum Auftragsmenü", fontSize = 16.sp)
            }
        }
    }
}
