import pandas as pd
from datetime import datetime
import requests

def get_omie_price_now():
    # 1. Gerar data de hoje para o URL
    hoje = datetime.now().strftime('%Y%m%d')
    url = f"https://www.omie.es/pt/file-download?parents=marginalpdbcpt&filename=marginalpdbcpt_{hoje}.1"
    
    try:
        # 2. Ler o ficheiro (os dados começam na linha 2)
        # O separador da OMIE é ';'
        df = pd.read_csv(url, sep=';', skiprows=1, header=None, encoding='latin-1')
        
        # Remove coluna vazia (última coluna só tem ';')
        df = df.iloc[:, :-1]
        
        # Nomes das colunas: [ANO, MES, DIA, HORA, PRECO, PRECO_ALT]
        df.columns = ['ano', 'mes', 'dia', 'hora', 'preco', 'preco_alt']
        
        # Obter a hora atual (1-24 conforme o ficheiro OMIE)
        hora_atual = datetime.now().hour
        if hora_atual == 0:
            hora_atual = 24  # A meia-noite é a hora 24 do dia anterior
        
        # Filtrar pelo preço da hora atual
        preco_mwh = df[df['hora'] == hora_atual]['preco'].values[0]
        
        return float(preco_mwh) / 1000  # Converte €/MWh para €/kWh
    except Exception as e:
        print(f"Erro ao obter dados: {e}")
        return None

preco_kwh = get_omie_price_now()
if preco_kwh is not None:
    print(f"Preço de mercado agora: {preco_kwh:.4f} €/kWh")
else:
    print("Não foi possível obter o preço de mercado.")