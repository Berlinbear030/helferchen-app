plugins {
    kotlin("multiplatform") version "1.9.20"
    kotlin("plugin.serialization") version "1.9.20"
    id("com.android.application") version "8.1.2"
    id("org.jetbrains.compose") version "1.5.10"
}

kotlin {
    androidTarget {
        compilations.all {
            kotlinOptions.jvmTarget = "1.8"
        }
    }

    sourceSets {
        val commonMain by getting {
            kotlin.srcDirs("common/src/commonMain/kotlin")
            dependencies {
                implementation(compose.runtime)
                implementation(compose.foundation)
                implementation(compose.material)
                implementation(compose.ui)

                val ktorVersion = "2.3.7"
                implementation("io.ktor:ktor-client-core:$ktorVersion")
                implementation("io.ktor:ktor-client-content-negotiation:$ktorVersion")
                implementation("io.ktor:ktor-client-auth:$ktorVersion")
                implementation("io.ktor:ktor-serialization-kotlinx-json:$ktorVersion")

                implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.7.3")
            }
        }
        val androidMain by getting {
            kotlin.srcDirs("android/src/main/kotlin")
            dependencies {
                implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
                implementation("io.ktor:ktor-client-okhttp:2.3.7")
                implementation("androidx.activity:activity-compose:1.8.1")
            }
        }
    }
}

android {
    namespace = "com.helferchen.app"
    compileSdk = 34
    defaultConfig {
        applicationId = "com.helferchen.app"
        minSdk = 24
        targetSdk = 34
        versionCode = 2
        versionName = "1.1"
    }
    signingConfigs {
        create("release") {
            storeFile = file("helferchen.keystore")
            storePassword = "password"
            keyAlias = "key0"
            keyPassword = "password"
        }
    }
    buildTypes {
        getByName("release") {
            signingConfig = signingConfigs.getByName("release")
        }
    }
    sourceSets {
        getByName("main") {
            manifest.srcFile("android/src/main/AndroidManifest.xml")
        }
    }
    compileOptions {
        isCoreLibraryDesugaringEnabled = true
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }
    dependencies {
        coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.0.4")
    }
}
