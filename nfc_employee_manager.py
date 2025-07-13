#!/usr/bin/env python3
"""
Script pour écrire les données employé sur les tags NFC
Utilise la bibliothèque nfcpy pour communiquer avec le lecteur NFC
"""

import nfc
import ndef
import json
import uuid
from datetime import datetime

class NFCEmployeeWriter:
    def __init__(self):
        self.clf = None
        
    def connect_reader(self):
        """Connecter le lecteur NFC"""
        try:
            self.clf = nfc.ContactlessFrontend('usb')
            print("✅ Lecteur NFC connecté avec succès")
            return True
        except Exception as e:
            print(f"❌ Erreur de connexion au lecteur NFC: {e}")
            return False
    
    def write_employee_data(self, employee_data):
        """Écrire les données employé sur un tag NFC"""
        if not self.clf:
            print("❌ Lecteur NFC non connecté")
            return False
            
        print(f"Placez le tag NFC pour l'employé: {employee_data['name']}")
        print("Appuyez sur Ctrl+C pour annuler...")
        
        try:
            tag = self.clf.connect(rdwr={'on-connect': lambda tag: self._write_data(tag, employee_data)})
            return True
        except KeyboardInterrupt:
            print("\n❌ Opération annulée par l'utilisateur")
            return False
        except Exception as e:
            print(f"❌ Erreur lors de l'écriture: {e}")
            return False
    
    def _write_data(self, tag, employee_data):
        """Écrire les données sur le tag"""
        try:
            # Créer l'ID unique pour le tag
            tag_id = str(uuid.uuid4())
            
            # Préparer les données à écrire
            nfc_data = {
                'type': 'timetracker24_employee',
                'tagId': tag_id,
                'employeeId': employee_data['id'],
                'name': employee_data['name'],
                'position': employee_data.get('position', ''),
                'created': datetime.now().isoformat(),
                'version': '1.0'
            }
            
            # Convertir en JSON
            json_data = json.dumps(nfc_data, ensure_ascii=False)
            
            # Créer l'enregistrement NDEF
            record = ndef.TextRecord(json_data, 'fr')
            message = [record]
            
            # Écrire sur le tag
            tag.ndef.records = message
            
            print(f"✅ Tag NFC écrit avec succès pour {employee_data['name']}")
            print(f"   Tag ID: {tag_id}")
            print(f"   Employee ID: {employee_data['id']}")
            
            return True
            
        except Exception as e:
            print(f"❌ Erreur lors de l'écriture des données: {e}")
            return False
    
    def read_employee_data(self):
        """Lire les données d'un tag NFC"""
        if not self.clf:
            print("❌ Lecteur NFC non connecté")
            return None
            
        print("Placez un tag NFC à lire...")
        print("Appuyez sur Ctrl+C pour annuler...")
        
        try:
            tag = self.clf.connect(rdwr={'on-connect': lambda tag: self._read_data(tag)})
            return tag
        except KeyboardInterrupt:
            print("\n❌ Lecture annulée")
            return None
        except Exception as e:
            print(f"❌ Erreur lors de la lecture: {e}")
            return None
    
    def _read_data(self, tag):
        """Lire les données du tag"""
        try:
            if tag.ndef:
                for record in tag.ndef.records:
                    if isinstance(record, ndef.TextRecord):
                        data = json.loads(record.text)
                        print(f"✅ Tag lu avec succès:")
                        print(f"   Type: {data.get('type', 'Unknown')}")
                        print(f"   Employé: {data.get('name', 'N/A')}")
                        print(f"   Poste: {data.get('position', 'N/A')}")
                        print(f"   Tag ID: {data.get('tagId', 'N/A')}")
                        print(f"   Employee ID: {data.get('employeeId', 'N/A')}")
                        return data
            else:
                print("❌ Aucune donnée NDEF trouvée sur le tag")
                return None
                
        except Exception as e:
            print(f"❌ Erreur lors de la lecture: {e}")
            return None
    
    def disconnect(self):
        """Déconnecter le lecteur NFC"""
        if self.clf:
            self.clf.close()
            print("✅ Lecteur NFC déconnecté")

def main():
    """Fonction principale pour gérer les tags NFC"""
    writer = NFCEmployeeWriter()
    
    if not writer.connect_reader():
        return
    
    try:
        while True:
            print("\n🏷️  GESTIONNAIRE DE TAGS NFC TIMETRACKER24")
            print("=" * 50)
            print("1. Écrire un nouveau tag employé")
            print("2. Lire un tag existant")
            print("3. Quitter")
            print("=" * 50)
            
            choice = input("Votre choix (1-3): ").strip()
            
            if choice == '1':
                print("\n📝 CRÉATION D'UN NOUVEAU TAG EMPLOYÉ")
                print("-" * 40)
                
                # Saisie des données employé
                employee_data = {}
                employee_data['id'] = str(uuid.uuid4())
                employee_data['name'] = input("Nom complet de l'employé: ").strip()
                employee_data['position'] = input("Poste/Position: ").strip()
                
                if employee_data['name']:
                    print(f"\n⚠️  ATTENTION: Vous allez écrire les données pour:")
                    print(f"   Nom: {employee_data['name']}")
                    print(f"   Poste: {employee_data['position']}")
                    print(f"   ID: {employee_data['id']}")
                    
                    confirm = input("\nConfirmer l'écriture ? (oui/non): ").strip().lower()
                    if confirm in ['oui', 'o', 'yes', 'y']:
                        writer.write_employee_data(employee_data)
                    else:
                        print("❌ Écriture annulée")
                else:
                    print("❌ Le nom de l'employé est obligatoire")
            
            elif choice == '2':
                print("\n📖 LECTURE D'UN TAG EXISTANT")
                print("-" * 30)
                writer.read_employee_data()
            
            elif choice == '3':
                print("👋 Au revoir !")
                break
            
            else:
                print("❌ Choix invalide. Veuillez choisir 1, 2 ou 3.")
    
    except KeyboardInterrupt:
        print("\n\n👋 Programme interrompu par l'utilisateur")
    
    finally:
        writer.disconnect()

if __name__ == "__main__":
    print("🚀 Démarrage du gestionnaire de tags NFC...")
    print("📋 Prérequis: Lecteur NFC connecté et tags NFC vides disponibles")
    print()
    main()