plugins {
    kotlin("multiplatform") version "1.9.20"
    id("com.android.application") version "8.1.2"
    id("org.jetbrains.compose") version "1.5.10"
}

kotlin {
    androidTarget {
        compilations.all {
            kotlinOptions.jvmTarget = "1.8"
        }
    }
    
    listOf(
        iosX64(),
        iosArm64(),
        iosSimulatorArm64()
    ).forEach {
        it.binaries.framework {
            baseName = "common"
        }
    }

    sourceSets {
        val commonMain by getting {
            dependencies {
                implementation(compose.runtime)
                implementation(compose.foundation)
                implementation(compose.material)
                implementation(compose.ui)
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
        versionCode = 1
        versionName = "1.0"
    }
}
