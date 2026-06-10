package com.helferchen.app

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.drawable.BitmapDrawable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.helferchen.app.api.ApiClient
import com.helferchen.app.model.Assignment
import com.helferchen.app.viewmodel.AppViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import org.osmdroid.config.Configuration
import org.osmdroid.events.MapEventsReceiver
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.MapEventsOverlay
import org.osmdroid.views.overlay.Marker

private val MapTeal = Color(0xFF00454A)

enum class PinColor { MINE, UNASSIGNED }

@Composable
fun MapScreen(vm: AppViewModel, onBack: () -> Unit) {
    var selectedInfo by remember { mutableStateOf<String?>(null) }
    val geocodeCache = remember { mutableMapOf<String, GeoPoint>() }
    var geocodedMine by remember { mutableStateOf<Map<String, GeoPoint>>(emptyMap()) }
    var geocodedUnassigned by remember { mutableStateOf<Map<String, GeoPoint>>(emptyMap()) }
    var mineAssignments by remember { mutableStateOf<List<Assignment>>(emptyList()) }
    var unassignedAssignments by remember { mutableStateOf<List<Assignment>>(emptyList()) }
    var loadError by remember { mutableStateOf<String?>(null) }
    val context = LocalContext.current
    val mapViewRef = remember { mutableStateOf<MapView?>(null) }

    DisposableEffect(Unit) {
        onDispose { mapViewRef.value?.onDetach() }
    }

    LaunchedEffect(Unit) {
        try {
            val resp = vm.apiClient.getMapAssignments()
            mineAssignments = resp.mine
            unassignedAssignments = resp.unassigned
            geocodeList(resp.mine, geocodeCache) { geocodedMine = it }
            geocodeList(resp.unassigned, geocodeCache) { geocodedUnassigned = it }
        } catch (e: Exception) {
            loadError = "Kartendaten konnten nicht geladen werden"
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        TopAppBar(
            title = { Text("Karte") },
            backgroundColor = MapTeal,
            contentColor = Color.White,
            navigationIcon = {
                TextButton(onClick = onBack) { Text("← Zurück", color = Color.White) }
            }
        )

        Box(modifier = Modifier.weight(1f)) {
            AndroidView(
                factory = { ctx ->
                    Configuration.getInstance().apply {
                        userAgentValue = ctx.packageName
                        osmdroidTileCache = ctx.cacheDir
                    }
                    MapView(ctx).also { mapViewRef.value = it }.apply {
                        setTileSource(TileSourceFactory.MAPNIK)
                        setMultiTouchControls(true)
                        controller.setZoom(7.0)
                        controller.setCenter(GeoPoint(51.1657, 10.4515))
                        overlays.add(0, MapEventsOverlay(object : MapEventsReceiver {
                            override fun singleTapConfirmedHelper(p: GeoPoint?) = false
                            override fun longPressHelper(p: GeoPoint?): Boolean {
                                p ?: return false
                                val m = coloredMarker(this@apply, android.graphics.Color.CYAN, "Manuell")
                                m.position = p
                                m.snippet = "%.5f°N, %.5f°E".format(p.latitude, p.longitude)
                                m.setOnMarkerClickListener { _, _ ->
                                    selectedInfo = m.snippet
                                    true
                                }
                                overlays.add(m)
                                invalidate()
                                return true
                            }
                        }))
                    }
                },
                update = { mapView ->
                    // Remove all assignment markers
                    val toRemove = mapView.overlays.filter {
                        it is Marker && (it.id?.startsWith("asgn:") == true)
                    }
                    mapView.overlays.removeAll(toRemove)

                    // Add green pins for current user's assignments
                    geocodedMine.forEach { (id, point) ->
                        val assignment = mineAssignments.find { it.id == id } ?: return@forEach
                        val address = assignment.customer?.address ?: ""
                        val m = coloredMarker(mapView, android.graphics.Color.parseColor("#22c55e"), assignment.title)
                        m.id = "asgn:mine:$id"
                        m.position = point
                        m.snippet = address
                        m.setOnMarkerClickListener { _, _ ->
                            selectedInfo = "🟢 ${assignment.title}\n$address"
                            true
                        }
                        mapView.overlays.add(m)
                    }

                    // Add yellow pins for unassigned appointments
                    geocodedUnassigned.forEach { (id, point) ->
                        val assignment = unassignedAssignments.find { it.id == id } ?: return@forEach
                        val address = assignment.customer?.address ?: ""
                        val m = coloredMarker(mapView, android.graphics.Color.parseColor("#eab308"), assignment.title)
                        m.id = "asgn:unasgn:$id"
                        m.position = point
                        m.snippet = address
                        m.setOnMarkerClickListener { _, _ ->
                            selectedInfo = "🟡 ${assignment.title}\n$address\n(Nicht zugewiesen)"
                            true
                        }
                        mapView.overlays.add(m)
                    }

                    mapView.invalidate()
                },
                modifier = Modifier.fillMaxSize()
            )

            selectedInfo?.let { info ->
                Card(
                    modifier = Modifier.align(Alignment.BottomCenter).padding(16.dp).fillMaxWidth(),
                    elevation = 8.dp,
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Termininfo", fontWeight = FontWeight.Bold, color = MapTeal)
                            Text(info, fontSize = 13.sp, color = Color.DarkGray)
                        }
                        TextButton(onClick = { selectedInfo = null }) { Text("✕") }
                    }
                }
            }

            loadError?.let { err ->
                Card(
                    modifier = Modifier.align(Alignment.TopCenter).padding(16.dp).fillMaxWidth(),
                    elevation = 4.dp, backgroundColor = Color(0xFFFFEBEE)
                ) {
                    Text(err, modifier = Modifier.padding(12.dp), color = Color.Red, fontSize = 13.sp)
                }
            }
        }

        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text("🟢 Meine Aufträge (${mineAssignments.size})", fontSize = 12.sp, color = Color.DarkGray)
            Text("🟡 Nicht zugewiesen (${unassignedAssignments.size})", fontSize = 12.sp, color = Color.DarkGray)
        }
        Text(
            "Langer Druck → manueller Pin",
            fontSize = 11.sp, color = Color.Gray,
            modifier = Modifier.padding(start = 12.dp, end = 12.dp, bottom = 4.dp)
        )
    }
}

private fun coloredMarker(mapView: MapView, color: Int, title: String): Marker {
    val size = 32
    val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        this.color = color
        style = Paint.Style.FILL
    }
    val strokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        this.color = android.graphics.Color.WHITE
        style = Paint.Style.STROKE
        strokeWidth = 3f
    }
    val r = size / 2f - 2f
    canvas.drawCircle(size / 2f, size / 2f, r, fillPaint)
    canvas.drawCircle(size / 2f, size / 2f, r, strokePaint)
    val m = Marker(mapView)
    m.title = title
    m.icon = BitmapDrawable(mapView.resources, bitmap)
    m.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER)
    return m
}

private suspend fun geocodeList(
    assignments: List<Assignment>,
    cache: MutableMap<String, GeoPoint>,
    onUpdate: (Map<String, GeoPoint>) -> Unit
) {
    var first = true
    assignments.forEach { assignment ->
        val address = assignment.customer?.address?.takeIf { it.isNotBlank() } ?: return@forEach
        if (cache.containsKey(assignment.id)) {
            onUpdate(cache.toMap())
            return@forEach
        }
        if (!first) delay(1100)
        first = false
        val point = withContext(Dispatchers.IO) { geocodeNominatim(address, "helferchen") }
        if (point != null) {
            cache[assignment.id] = point
            onUpdate(cache.toMap())
        }
    }
}

private fun geocodeNominatim(address: String, userAgent: String): GeoPoint? {
    return try {
        val encoded = java.net.URLEncoder.encode(address, "UTF-8")
        val url = java.net.URL("https://nominatim.openstreetmap.org/search?q=$encoded&format=json&limit=1")
        val conn = (url.openConnection() as java.net.HttpURLConnection).apply {
            setRequestProperty("User-Agent", userAgent)
            connectTimeout = 5000
            readTimeout = 5000
        }
        val body = conn.inputStream.bufferedReader().readText()
        val lat = Regex(""""lat":"([^"]+)"""").find(body)?.groupValues?.get(1)?.toDoubleOrNull()
        val lon = Regex(""""lon":"([^"]+)"""").find(body)?.groupValues?.get(1)?.toDoubleOrNull()
        if (lat != null && lon != null) GeoPoint(lat, lon) else null
    } catch (e: Exception) {
        null
    }
}
