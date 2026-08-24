pipeline {
    agent any

    parameters {
        choice(
            name: 'ENVIRONMENT_TYPE',
            choices: ['Safe_Sandbox_Mock', 'Test_Server_Forms'],
            description: 'Choose target mode (Isolate form testing via Test_Server_Forms or use Sandbox)'
        )
        string(
            name: 'TEST_SERVER_ID',
            defaultValue: 'test1',
            description: 'Enter test1 through test55 (e.g., test12)'
        )
        choice(
            name: 'DEVICE_TYPE',
            choices: ['desktop', 'mobile'],
            description: 'Desktop view or Mobile view (/m/)'
        )
        string(
            name: 'PATH_OR_ENDPOINT',
            defaultValue: '/order/ncf',
            description: 'Target endpoint: e.g., /order/ncf, /login, /signup, etc.'
        )
        string(
            name: 'FULL_URL_OVERRIDE',
            defaultValue: '',
            description: 'Optional: Paste any complete URL to test directly'
        )
        choice(
            name: 'PROFILE',
            choices: ['smoke', 'load', 'stress', 'spike', 'soak'],
            description: 'Select the traffic pattern for this test run'
        )
    }

    stages {
        stage('Prepare Test Data') {
            steps {
                dir('D:/Testing Goals/Performance Testing_K6_Javascript_New/performance-framework') {
                    writeFile file: 'data/users.csv', text: '''username,password
admin_alpha,pass123
tester_beta,pass456
dev_gamma,pass789
sys_delta,pass000
manager_omega,pass111'''
                }
            }
        }

        stage('Execute k6 Load Test') {
            steps {
                dir('D:/Testing Goals/Performance Testing_K6_Javascript_New/performance-framework') {
                    echo "Running [${params.PROFILE}] test against form endpoint"
                    bat "k6 run -e ENVIRONMENT_TYPE=\"${params.ENVIRONMENT_TYPE}\" -e TEST_SERVER_ID=\"${params.TEST_SERVER_ID}\" -e DEVICE_TYPE=\"${params.DEVICE_TYPE}\" -e PATH_OR_ENDPOINT=\"${params.PATH_OR_ENDPOINT}\" -e FULL_URL_OVERRIDE=\"${params.FULL_URL_OVERRIDE}\" -e PROFILE=\"${params.PROFILE}\" scripts/url_load_test.js"
                }
            }
        }
    }

    post {
        always {
            dir('D:/Testing Goals/Performance Testing_K6_Javascript_New/performance-framework') {
                archiveArtifacts artifacts: 'reports/summary.html', fingerprint: true, allowEmptyArchive: false
                junit 'reports/junit.xml'
            }
        }
    }
}