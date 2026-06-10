package com.helferchen.app

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

@Composable
fun MapScreen(vm: AppViewModel, onBack: () -> Unit) {
    val assignments by vm.assignments.collectAsState()
    var selectedInfo by remember { mutableStateOf<String?>(null) }
    val geocodeCache = remember { mutableMapOf<String, GeoPoint>() }
    var geocodedPins by remember { mutableStateOf<Map<String, GeoPoint>>(emptyMap()) }
    val context = LocalContext.current
    val mapViewRef = remember { mutableStateOf<MapView?>(null) }

    DisposableEffect(Unit) {
        onDispose { mapViewRef.value?.onDetach() }
    }

    LaunchedEffect(assignments) {
        var first = true
        assignments.forEach { assignment ->
            val address = assignment.customer?.address?.takeIf { it.isNotBlank() } ?: return@forEach
            if (geocodeCache.containsKey(assignment.id)) return@forEach
            if (!first) delay(1100) // Nominatim rate limit: 1 req/s
            first = false
            val point = withContext(Dispatchers.IO) {
                geocodeNominatim(address, context.packageName)
            }
            if (point != null) {
                geocodeCache[assignment.id] = point
                geocodedPins = geocodeCache.toMap()
            }
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        TopAppBar(
            title = { Text("Karte") },
            backgroundColor = MapTeal,
            contentColor = Color.White,
            navigationIcon = {
                TextButton(onClick = onBack) {
                    Text("← Zurück", color = Color.White)
                }
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
                                val m = Marker(this@apply)
                                m.position = p
                                m.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM)
                                m.title = "Manueller Pin"
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
                    val toRemove = mapView.overlays.filter {
                        it is Marker && it.id?.startsWith("asgn:") == true
                    }
                    mapView.overlays.removeAll(toRemove)
                    geocodedPins.forEach { (id, point) ->
                        val assignment = assignments.find { it.id == id } ?: return@forEach
                        val address = assignment.customer?.address ?: ""
                        val m = Marker(mapView)
                        m.id = "asgn:$id"
                        m.position = point
                        m.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM)
                        m.title = assignment.title
                        m.snippet = address
                        m.setOnMarkerClickListener { _, _ ->
                            selectedInfo = "${assignment.title}\n$address"
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
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .padding(16.dp)
                        .fillMaxWidth(),
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
                        TextButton(onClick = { selectedInfo = null }) {
                            Text("✕")
                        }
                    }
                }
            }
        }

        Text(
            "Langer Druck → manueller Pin  •  Termine werden automatisch eingetragen",
            fontSize = 11.sp,
            color = Color.Gray,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
        )
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
