      #!/usr/bin/env python
      # src/data_gathering_crew/main.py
      from data_gathering_crew.crew import DataGatheringCrew
      from flask import Flask, request, jsonify

      app = Flask(__name__)


      @app.route('/extract', methods=['POST'])
      def kickoff():
          """
            Run the crew and return the data as json.
            """
          data = request.get_json()
          text_to_process = data.get("text", None)

          if not text_to_process:
              return jsonify({"message": "Text not provided"}), 400

          result = DataGatheringCrew().crew().kickoff(inputs={"text": text_to_process})
          return jsonify({"result": result})


      if __name__ == "__main__":
        app.run(host='0.0.0.0', port=5001, debug=True)