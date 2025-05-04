import { useEffect, useState } from 'react';
import { Platform, View, Text, StyleSheet, ActivityIndicator, Button, ScrollView, Image, useColorScheme } from 'react-native';
import * as Location from 'expo-location';

const OPEN_METEO_API_URL = 'https://api.open-meteo.com/v1/forecast';

interface LocationCoords {
    latitude: number;
    longitude: number;
}

interface OpenMeteoCurrentWeather {
    temperature: number;
    windspeed: number;
    winddirection: number;
    weathercode: number;
    time: string;
}

interface OpenMeteoHourly {
    time: string[];
    temperature_2m: number[];
    relative_humidity_2m: number[];
    dew_point_2m: number[];
    apparent_temperature: number[];
    weather_code: number[];
    surface_pressure: number[];
    visibility: number[];
    wind_speed_10m: number[];
    wind_direction_10m: number[];
    uv_index: number[];
}

interface OpenMeteoDaily {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    sunrise: string[];
    sunset: string[];
    uv_index_max: number[];
    precipitation_sum: number[];
    precipitation_hours: number[];
    precipitation_probability_max: string[];
}

interface OpenMeteoData {
    latitude: number;
    longitude: number;
    generationtime_ms: number;
    utc_offset_seconds: number;
    timezone: string;
    timezone_abbreviation: string;
    elevation: number;
    current_weather?: OpenMeteoCurrentWeather;
    hourly?: OpenMeteoHourly;
    daily?: OpenMeteoDaily;
}

const getWeatherBackgroundColor = (weatherCode: number | undefined): string => {
    if (weatherCode === undefined) {
        return '#ffffff';
    }
    switch (weatherCode) {
        case 0:
            return '#6495ED';
        case 1:
        case 2:
            return '#87CEEB';
        case 3:
            return '#A9A9A9';
        case 45:
        case 48:
            return '#E0FFFF';
        case 51:
        case 53:
        case 55:
        case 56:
        case 57:
        case 61:
        case 63:
        case 65:
        case 66:
        case 67:
        case 80:
        case 81:
        case 82:
            return '#4682B4';
        case 71:
        case 73:
        case 75:
        case 77:
        case 85:
        case 86:
            return '#DCDCDC';
        case 95:
        case 96:
        case 99:
            return '#404040';
        default:
            return '#f0f0f0';
    }
};

const getWeatherDescription = (weatherCode: number | undefined): string | undefined => {
    if (weatherCode === undefined) {
        return undefined;
    }
    switch (weatherCode) {
        case 0: return 'Céu limpo';
        case 1: return 'Principalmente limpo';
        case 2: return 'Parcialmente nublado';
        case 3: return 'Nublado';
        case 45: return 'Neblina';
        case 48: return 'Neblina geada';
        case 51: return 'Chuvisco leve';
        case 53: return 'Chuvisco moderado';
        case 55: return 'Chuvisco denso';
        case 56: return 'Chuvisco congelante leve';
        case 57: return 'Chuvisco congelante denso';
        case 61: return 'Chuva leve';
        case 63: return 'Chuva moderada';
        case 65: return 'Chuva forte';
        case 66: return 'Chuva congelante leve';
        case 67: return 'Chuva congelante forte';
        case 71: return 'Geleira';
        case 73: return 'Neve leve';
        case 75: return 'Neve moderada';
        case 77: return 'Granizo fino';
        case 80: return 'Pancadas de chuva leves';
        case 81: return 'Pancadas de chuva moderadas';
        case 82: return 'Pancadas de chuva fortes';
        case 85: return 'Pancadas de neve leves';
        case 86: return 'Pancadas de neve fortes';
        case 95: return 'Trovão leve ou moderado';
        case 96: return 'Trovão com slight hail';
        case 99: return 'Trovão com heavy hail';
        default: return undefined;
    }
};

const getWeatherIconUrl = (iconCode: string | undefined): string | undefined => {
    if (!iconCode) {
        return undefined;
    }
    return `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
};

const weatherCodeToOpenWeatherIcon = (weatherCode: number | undefined, isDay: boolean | null): string | undefined => {
    if (weatherCode === undefined || isDay === null) {
        return undefined;
    }

    const dayOrNight = isDay ? 'd' : 'n';

    switch (weatherCode) {
        case 0: // Clear sky
            return `01${dayOrNight}`;
        case 1: // Mainly clear
        case 2: // Partly cloudy
            return `02${dayOrNight}`;
        case 3: // Overcast
            return `04${dayOrNight}`;
        case 45: // Fog and depositing rime fog
        case 48: // Fog and depositing rime fog
            return `50${dayOrNight}`;
        case 51: // Drizzle: Light intensity
        case 53: // Drizzle: Moderate intensity
        case 55: // Drizzle: Dense intensity
        case 56: // Freezing Drizzle: Light intensity
        case 57: // Freezing Drizzle: Dense intensity
        case 61: // Rain: Slight intensity
        case 63: // Rain: Moderate intensity
        case 65: // Rain: Heavy intensity
        case 66: // Freezing Rain: Light intensity
        case 67: // Freezing Rain: Heavy intensity
        case 80: // Rain showers: Slight intensity
        case 81: // Rain showers: Moderate intensity
        case 82: // Rain showers: Violent intensity
            return `10${dayOrNight}`;
        case 71: // Snow grains
        case 73: // Snow: Slight intensity
        case 75: // Snow: Moderate intensity
        case 77: // Snow pellets
        case 85: // Snow showers: Slight intensity
        case 86: // Snow showers: Heavy intensity
            return `13${dayOrNight}`;
        case 95: // Thunderstorm: Slight or moderate
        case 96: // Thunderstorm with slight hail
        case 99: // Thunderstorm with heavy hail
            return `11${dayOrNight}`;
        default:
            return undefined;
    }
};

export default function Weather() {
    const [location, setLocation] = useState<LocationCoords | null>(null);
    const [weatherData, setWeatherData] = useState<OpenMeteoData | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);
    const [isDay, setIsDay] = useState<boolean | null>(null);

    const colorScheme = useColorScheme();
    const isDarkMode = colorScheme === 'dark';

    useEffect(() => {
        fetchLocationAndWeather();
    }, []);

    const fetchLocationAndWeather = async () => {
        setLoading(true);
        try {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setErrorMsg('Permissão para acessar localização foi negada.');
                setLoading(false);
                return;
            }

            let currentLocation = await Location.getCurrentPositionAsync({});
            setLocation(currentLocation.coords);

            await fetchWeather(currentLocation.coords.latitude, currentLocation.coords.longitude);
        } catch (error) {
            console.error(error);
            setErrorMsg('Erro ao obter localização.');
            setLoading(false);
        }
    };

    const fetchWeather = async (lat: number, lon: number) => {
        try {
            const response = await fetch(
                `${OPEN_METEO_API_URL}?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,relative_humidity_2m,dew_point_2m,apparent_temperature,weather_code,surface_pressure,visibility,wind_speed_10m,wind_direction_10m,uv_index&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_sum,precipitation_hours,precipitation_probability_max&timezone=America/Sao_Paulo&forecast_days=7`
            );
            const data: OpenMeteoData = await response.json();

            if (data.current_weather && data.hourly && data.daily) {
                setWeatherData(data);
                setLastUpdated(new Date().toLocaleString());
                const now = new Date();

                if (data.daily.sunrise && data.daily.sunrise.length > 0 && data.daily.sunset && data.daily.sunset.length > 0) {
                    const sunrise = new Date(data.daily.sunrise[0]);
                    const sunset = new Date(data.daily.sunset[0]);
                    setIsDay(now > sunrise && now < sunset);
                } else {
                    setIsDay(null);
                }
                setLoading(false);
            } else {
                setErrorMsg('Erro ao buscar dados do clima.');
                setLoading(false);
            }
        } catch (error) {
            console.error(error);
            setErrorMsg('Erro ao buscar dados do clima.');
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007bff" />
                <Text style={styles.loadingText}>Carregando previsão do tempo...</Text>
            </View>
        );
    }

    if (errorMsg) {
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
        );
    }

    const current = weatherData?.current_weather;
    const hourly = weatherData?.hourly;
    const daily = weatherData?.daily;
    const weatherCode = current?.weathercode;
    const weatherBackgroundColor = getWeatherBackgroundColor(weatherCode);

    const apparentTemperature = hourly?.apparent_temperature?.[0];
    const temperature2m = hourly?.temperature_2m?.[0];
    const relativeHumidity = hourly?.relative_humidity_2m?.[0];
    const dewPoint = hourly?.dew_point_2m?.[0];
    const hourlyWeatherCode = hourly?.weather_code?.[0];
    const surfacePressure = hourly?.surface_pressure?.[0];
    const visibilityMeters = hourly?.visibility?.[0];
    const windSpeedMs = current?.windspeed;
    const windDirection = current?.winddirection;
    const uvIndexCurrent = hourly?.uv_index?.[0];

    const windSpeedKmH = windSpeedMs !== undefined ? (windSpeedMs * 3.6).toFixed(1) : undefined; // Converte m/s para km/h, 1 casa decimal
    const visibilityKm = visibilityMeters !== undefined ? (visibilityMeters / 1000).toFixed(1) : undefined; // Converte m para km, 1 casa decimal

    const temperatureMaxDaily = daily?.temperature_2m_max;
    const temperatureMinDaily = daily?.temperature_2m_min;
    const precipitationProbabilityMaxDaily = daily?.precipitation_probability_max;
    const uvIndexMaxDaily = daily?.uv_index_max;
    const precipitationSumDaily = daily?.precipitation_sum;
    const precipitationHoursDaily = daily?.precipitation_hours;
    const dailyTimes = daily?.time;

    const weatherIconCode = weatherCodeToOpenWeatherIcon(hourlyWeatherCode, isDay);
    const weatherIconUrl = getWeatherIconUrl(weatherIconCode);

    return (
        <View style={{ flex: 1, backgroundColor: weatherBackgroundColor }}>
            <View style={[styles.safeTopBar, isDarkMode && { backgroundColor: '#000000' }]} />
            <ScrollView contentContainerStyle={styles.scrollViewContent}>
                <View style={[styles.container, Platform.OS === 'android' && { paddingTop: 40 }]}>

                    <Text style={styles.title}>Previsão do Tempo</Text>

                    {current ? (
                        <>
                            <View style={styles.currentWeatherContainer}>
                                {weatherIconUrl && (
                                    <Image
                                        source={{ uri: weatherIconUrl }}
                                        style={{ width: 100, height: 100 }}
                                    />
                                )}

                                {temperature2m !== undefined && (
                                    <Text style={styles.temperature}>{Math.round(temperature2m)}°C</Text>
                                )}

                                <Text style={styles.weatherDescription}>
                                    {getWeatherDescription(hourlyWeatherCode) || 'Descrição indisponível'}
                                </Text>

                                {apparentTemperature !== undefined && (
                                    <Text style={styles.currentDetailText}>Sensação Térmica: {Math.round(apparentTemperature)}°C</Text>
                                )}
                            </View>

                            {dailyTimes && temperatureMaxDaily && precipitationProbabilityMaxDaily &&
                                dailyTimes.length > 0 && temperatureMaxDaily.length === dailyTimes.length && precipitationProbabilityMaxDaily.length === dailyTimes.length && (
                                    <View style={styles.forecastCard}>
                                        <Text style={styles.forecastCardTitle}>Previsão Semanal</Text>
                                        {dailyTimes.map((time, index) => {
                                            if (index === 0) return null;

                                            const date = new Date(time);
                                            const dayOfWeek = date.toLocaleDateString('pt-BR', { weekday: 'short' });
                                            const formattedDate = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                                            const maxTemp = temperatureMaxDaily[index];
                                            const precipProb = precipitationProbabilityMaxDaily[index];

                                            return (
                                                <View key={time} style={styles.dailyForecastItem}>
                                                    <Text style={styles.dailyForecastDate}>{dayOfWeek}, {formattedDate}</Text>
                                                    <Text style={styles.dailyForecastText}>Máx: {Math.round(maxTemp)}°C</Text>
                                                    <Text style={styles.dailyForecastText}>Chuva: {precipProb}%</Text>
                                                </View>
                                            );
                                        })}
                                    </View>
                                )
                            }

                            <View style={styles.currentWeatherDetailsContainer}>
                                {temperatureMaxDaily?.[0] !== undefined && (
                                    <View style={styles.gridItem}>
                                        <View style={styles.detailCard}>
                                            <Text style={styles.detailTitle}>Máxima</Text>
                                            <Text style={styles.detailText}>{Math.round(temperatureMaxDaily[0])}°C</Text>
                                        </View>
                                    </View>
                                )}

                                {temperatureMinDaily?.[0] !== undefined && (
                                    <View style={styles.gridItem}>
                                        <View style={styles.detailCard}>
                                            <Text style={styles.detailTitle}>Mínima</Text>
                                            <Text style={styles.detailText}>{Math.round(temperatureMinDaily[0])}°C</Text>
                                        </View>
                                    </View>
                                )}

                                {precipitationProbabilityMaxDaily?.[0] !== undefined && (
                                    <View style={styles.gridItem}>
                                        <View style={styles.detailCard}>
                                            <Text style={styles.detailTitle}>Probabilidade de Chuva</Text>
                                            <Text style={styles.detailText}>{precipitationProbabilityMaxDaily[0]}%</Text>
                                        </View>
                                    </View>
                                )}

                                {precipitationSumDaily?.[0] !== undefined && (
                                    <View style={styles.gridItem}>
                                        <View style={styles.detailCard}>
                                            <Text style={styles.detailTitle}>Precipitação</Text>
                                            <Text style={styles.detailText}>{precipitationSumDaily[0]} mm</Text>
                                        </View>
                                    </View>
                                )}

                                {precipitationHoursDaily?.[0] !== undefined && (
                                    <View style={styles.gridItem}>
                                        <View style={styles.detailCard}>
                                            <Text style={styles.detailTitle}>Horas de Chuva Hoje</Text>
                                            <Text style={styles.detailText}>{precipitationHoursDaily[0]}</Text>
                                        </View>
                                    </View>
                                )}

                                {relativeHumidity !== undefined && (
                                    <View style={styles.gridItem}>
                                        <View style={styles.detailCard}>
                                            <Text style={styles.detailTitle}>Umidade</Text>
                                            <Text style={styles.detailText}>{relativeHumidity}%</Text>
                                        </View>
                                    </View>
                                )}

                                {dewPoint !== undefined && (
                                    <View style={styles.gridItem}>
                                        <View style={styles.detailCard}>
                                            <Text style={styles.detailTitle}>Ponto de Orvalho</Text>
                                            <Text style={styles.detailText}>{Math.round(dewPoint)}°C</Text>
                                        </View>
                                    </View>
                                )}

                                {windSpeedKmH !== undefined && (
                                    <View style={styles.gridItem}>
                                        <View style={styles.detailCard}>
                                            <Text style={styles.detailTitle}>Velocidade do Vento</Text>
                                            <Text style={styles.detailText}>{windSpeedKmH} km/h</Text>
                                        </View>
                                    </View>
                                )}

                                <View style={styles.gridItem}>
                                    <View style={styles.detailCard}>
                                        <Text style={styles.detailTitle}>Direção do Vento</Text>
                                        <Text style={styles.detailText}>{windDirection}°</Text>
                                    </View>
                                </View>

                                {surfacePressure !== undefined && (
                                    <View style={styles.gridItem}>
                                        <View style={styles.detailCard}>
                                            <Text style={styles.detailTitle}>Pressão</Text>
                                            <Text style={styles.detailText}>{surfacePressure} hPa</Text>
                                        </View>
                                    </View>
                                )}

                                {visibilityKm !== undefined && (
                                    <View style={styles.gridItem}>
                                        <View style={styles.detailCard}>
                                            <Text style={styles.detailTitle}>Visibilidade</Text>
                                            <Text style={styles.detailText}>{visibilityKm} km</Text>
                                        </View>
                                    </View>
                                )}

                                {uvIndexMaxDaily?.[0] !== undefined && (
                                    <View style={styles.gridItem}>
                                        <View style={styles.detailCard}>
                                            <Text style={styles.detailTitle}>Índice UV Máx.</Text>
                                            <Text style={styles.detailText}>{uvIndexMaxDaily[0]}</Text>
                                        </View>
                                    </View>
                                )}

                                <View style={styles.gridItem}>
                                    <View style={styles.detailCard}>
                                        <Text style={styles.detailTitle}>Índice UV</Text>
                                        <Text style={styles.detailText}>{uvIndexCurrent}</Text>
                                    </View>
                                </View>
                            </View>

                            <View style={styles.sunPositionContainer}>
                                {daily?.sunrise && daily?.sunset && daily.sunrise.length > 0 && daily.sunset.length > 0 && (
                                    <>
                                        {isDay !== null && (
                                            <Text style={styles.sunTitle}>{isDay ? 'Dia' : 'Noite'}</Text>
                                        )}

                                        <Text style={styles.sunText}>Nascer do Sol: {new Date(daily.sunrise[0]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>

                                        <Text style={styles.sunText}>Pôr do Sol: {new Date(daily.sunset[0]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                                    </>
                                )}
                            </View>

                            {lastUpdated && <Text style={styles.lastUpdatedText}>Última atualização: {lastUpdated}</Text>}

                            <Button title="Atualizar Previsão" onPress={fetchLocationAndWeather} />
                        </>
                    ) : (
                        <Text>Dados de clima não disponíveis.</Text>
                    )}
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f0f0f0',
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
        color: '#333',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#ffe0b2',
    },
    errorText: {
        fontSize: 18,
        color: '#d32f2f',
        textAlign: 'center',
    },
    scrollViewContent: {
        flexGrow: 1,
    },
    container: {
        padding: 20,
        alignItems: 'center',
    },
    safeTopBar: {
        height: Platform.OS === 'android' ? 30 : 0,
        backgroundColor: 'white',
        zIndex: 1,
    },
    title: {
        fontSize: 26,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
    },
    currentWeatherContainer: {
        padding: 10,
        borderRadius: 10,
        elevation: 3,
        marginBottom: 20,
        width: '100%',
        maxWidth: 400,
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    temperature: {
        fontSize: 48,
        fontWeight: 'bold',
        marginBottom: 5,
    },
    weatherDescription: {
        fontSize: 24,
        fontWeight: 'semibold',
        textTransform: 'capitalize',
        marginBottom: 5,
    },
    currentDetailText: {
        fontSize: 18,
    },
    currentWeatherDetailsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -5,
        marginBottom: 20,
        width: '100%',
        maxWidth: 400,
    },
    gridItem: {
        width: '50%',
        paddingHorizontal: 5,
        marginBottom: 10,
    },
    detailCard: {
        backgroundColor: '#fff',
        padding: 10,
        borderRadius: 10,
        elevation: 3,
        alignItems: 'center',
        justifyContent: 'center',
        height: 150,
    },
    detailTitle: {
        fontSize: 14,
        textTransform: 'uppercase',
        fontWeight: 'bold',
        color: '#666',
        textAlign: 'center',
    },
    detailText: {
        fontSize: 26,
        color: '#333',
    },
    sunPositionContainer: {
        backgroundColor: '#ffffff',
        padding: 15,
        borderRadius: 10,
        elevation: 5,
        marginBottom: 20,
        width: '100%',
        maxWidth: 400,
    },
    sunTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 5,
    },
    sunText: {
        fontSize: 16,
        color: '#333',
        marginBottom: 5,
    },
    forecastCard: {
        backgroundColor: '#ffffff',
        paddingVertical: 20,
        borderRadius: 10,
        elevation: 3,
        marginBottom: 20,
        width: '100%',
        maxWidth: 400,
    },
    forecastCardTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 10,
        textAlign: 'center',
    },
    dailyForecastItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    dailyForecastDate: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#555',
        flex: 1,
    },
    dailyForecastText: {
        fontSize: 16,
        color: '#333',
        marginLeft: 10,
    },
    lastUpdatedText: {
        fontSize: 14,
        color: '#555',
        marginTop: 10,
        marginBottom: 10,
    },
    toolbar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    }
});
