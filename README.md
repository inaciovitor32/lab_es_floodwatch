# Floodwatch

Projeto de conclusão para o curso de Lab. de Engenharia de Software Q1 - 2025 ministrado pela Prof.ª Dr.ª Juliana Braga.

__APLICATIVO FINALIZADO PARA ANDROID:__ https://drive.google.com/file/d/1-qHFB0P6pD8TQzkF91E6HSKf9VI-muJP/view?usp=drive_link

__Expo Go API Ver. 52 para testar builds feitos pelo desenvolvedor:__ https://drive.google.com/file/d/1-hnoENMHycb80JEVxZrHVBH5b8qdz01B/view?usp=drive_link

## Sobre o projeto

O Floodwatch é um aplicativo móvel desenvolvido para dispositivos Android, com o objetivo principal de permitir que os usuários registrem e consultem ocorrências de alagamentos em suas regiões. Além disso, o app também permite relatar e visualizar outros eventos relacionados a chuvas intensas, como enxurradas, deslizamentos de terra, desmoronamentos, danos à rede elétrica e quedas de árvores.

A proposta central da ferramenta é funcionar como um recurso colaborativo, oferecendo à população meios práticos para prevenir e se proteger dos efeitos negativos de chuvas intensas. O aplicativo também tem a função de armazenar, de forma organizada, os relatos enviados pelos cidadãos, formando um histórico de informações que pode ser utilizado por órgãos públicos e prefeituras para monitoramento e planejamento de ações preventivas.

## Stack

### Frontend:

* React Native – Framework para desenvolvimento mobile multiplataforma.
* Expo – Ferramenta que simplifica o desenvolvimento e o acesso a APIs nativas no React Native.

### Geolocalização e Mapas:

* API de Geolocalização do dispositivo – Para obter a localização exata dos relatos.
* Google Maps API – Para visualização interativa dos pontos no mapa.

### Backend (BaaS):

* Firebase – Armazenamento em nuvem dos reportes e sincronização em tempo real.

### Dados Meteorológicos:

* Open-Meteo API – Fornecimento de informações climáticas e previsões do tempo.

## Instruções

### Preparando o projeto

Criar uma conta gratuita na Google Cloud Platform (GCP)

Acessar a plataforma do Firebase e inicializar o serviço Cloud Firestore (https://console.firebase.google.com/) criando um novo projeto

Obter o objeto de configuração da plataforma:

Exemplo:
```
const firebaseConfig = {
  apiKey: "SUA_CHAVE_DE_API",
  authDomain: "SEU_DOMÍNIO",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_STORAGE_BUCKET",
  messagingSenderId: "SEU_ID",
  appId: "SEU_APP_ID"
};
```

Inserir o objeto de configuração na linha 5 do arquivo ___firebaseConfig.ts___

Acessar ainda na GCP a plataforma do Google Maps (https://console.cloud.google.com/google/maps-apis), criar um novo projeto ativar a API para as plataformas Android e Web

Fazer o download do arquivo ___google-services.json___ e inserir na raíz do projeto

Inseir a chave de API para o serviço do Google Maps para a plataforma Android em ___app.json___:

```
    "android": {
      "config": {
        "googleMaps": {
          "apiKey": "YOUR_API_KEY"
        }
      },
```

## Inciando

Com o Node JS LTS instalado, rodar o comando no terminal na raíz do projeto:
```
npm install
```
Aguardar a instalação das dependências do projeto...

## Testando o projeto em um dispositivo móvel

No terminal na raiz do projeto, rodar o seguinte comando:
```
npx expo start --tunnel
```
Quando o processo for concluído, digitar s

Istalar o Expo Go no dispositivo Android através do apk fornecido

Com o dispositivo Android, escanear o QR CODE que aparece no terminal, isso abrirá uma página da Web, selecione a opção para carregar o projeto no Expo Go

Pronto! O projeto será carregado e você já pode testá-lo em seu dispositivo Android
