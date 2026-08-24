pipeline {
    agent any

    parameters {
        string(
            name: 'TARGET_URL',
            defaultValue: 'https://httpbin.test.k6.io/get',
            description: 'Enter the endpoint URL to run performance tests against'
        )
    }

    stages {
        stage('Execute k6 Load Test') {
            steps {
                echo "Running Performance Test against: ${params.TARGET_URL}"
                bat "k6 run -e TARGET_URL=\"${params.TARGET_URL}\" scripts/url_load_test.js"
            }
        }
    }

    post {
        always {
            archiveArtifacts artifacts: 'reports/summary.html', fingerprint: true, allowEmptyArchive: false
            junit 'reports/junit.xml'
        }
    }
}